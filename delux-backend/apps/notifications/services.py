"""Envío de emails transaccionales usando SMTP de PlatformSettings."""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from django.template.loader import render_to_string

from apps.settings.models import PlatformSettings


def _smtp_send_raw(from_email: str, to_email: str, raw_message: str) -> bool:
    """Envío SMTP real (bloqueante). Lo usa la tarea Celery y el fallback."""
    s = PlatformSettings.load()
    if not s.smtp_host:
        print(f'[email skipped] → {to_email}')
        return False
    try:
        if s.smtp_use_ssl:
            smtp = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=20)
        else:
            smtp = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20)
            if s.smtp_use_tls:
                smtp.starttls()
        if s.smtp_username:
            smtp.login(s.smtp_username, s.smtp_password)
        smtp.sendmail(from_email, [to_email], raw_message)
        smtp.quit()
        return True
    except Exception as e:
        print(f'[email error] → {to_email}: {e}')
        return False


def send_html_email(to_email: str, subject: str, template: str, ctx: dict, text_fallback: str = ''):
    """Renderiza el correo (rápido) y lo envía EN SEGUNDO PLANO con Celery, para
    no bloquear la respuesta de la API con el SMTP. Si el broker no responde,
    cae a envío síncrono para no perder el correo."""
    s = PlatformSettings.load()
    if not s.smtp_host:
        print(f'[email skipped] {subject} → {to_email}')
        return False

    # Logo absoluto para el encabezado del correo (los correos no admiten rutas relativas).
    logo_url = ''
    try:
        if getattr(s, 'site_logo', None):
            base = (os.getenv('FRONTEND_URL') or '').rstrip('/')
            if base:
                logo_url = f'{base}{s.site_logo.url}'
    except Exception:
        logo_url = ''

    html = render_to_string(f'emails/{template}.html', {
        **ctx,
        'platform_name': s.platform_name,
        'platform_tagline': s.platform_tagline,
        'support_email': s.support_email,
        'logo_url': logo_url,
    })

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'{s.default_from_name} <{s.default_from_email}>'
    msg['To'] = to_email
    msg.attach(MIMEText(text_fallback or subject, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))

    from_email = s.default_from_email
    raw = msg.as_string()

    # Encola el envío (Celery). Redis recibe el mensaje al instante; el worker
    # hace el SMTP lento aparte, sin que el usuario espere.
    try:
        from .tasks import deliver_email
        deliver_email.delay(from_email, to_email, raw)
        return True
    except Exception as e:
        print(f'[email queue failed → envío síncrono] {e}')
        return _smtp_send_raw(from_email, to_email, raw)


def notify_order_paid(order):
    """Email de confirmación al cliente."""
    if not order.customer or not order.customer.email:
        return
    send_html_email(
        to_email=order.customer.email,
        subject=f'Tu orden {order.code} ha sido confirmada ✓',
        template='order_paid',
        ctx={
            'customer_name': order.customer.full_name,
            'order_code': order.code,
            'order_total': order.total,
            'items': order.items.all(),
            'branch_name': order.branch.name,
        },
    )


def notify_order_shipped(order, tracking_code=''):
    if not order.customer or not order.customer.email:
        return
    send_html_email(
        to_email=order.customer.email,
        subject=f'Tu orden {order.code} está en camino 🚚',
        template='order_shipped',
        ctx={
            'customer_name': order.customer.full_name,
            'order_code': order.code,
            'tracking_code': tracking_code,
        },
    )


# Mapping de estado → (asunto, template, emoji)
# Correos al CLIENTE: SOLO en hitos importantes (no en cada cambio de estado).
# Entregado, cancelado y devolución. El resto de estados solo notifican in-app.
_STATE_EMAILS = {
    'DELIVERED':  ('¡Tu orden {code} fue entregada!', 'order_state', '✅'),
    'CANCELLED':  ('Tu orden {code} fue cancelada', 'order_state', '❌'),
    'REFUNDED':   ('Procesamos la devolución de tu orden {code}', 'order_state', '↩️'),
    'RETURNED':   ('Registramos la devolución de tu orden {code}', 'order_state', '↩️'),
}


def notify_order_state_change(order, new_status: str, tracking_code: str = ''):
    """Email genérico para cada cambio de estado."""
    if not order.customer or not order.customer.email:
        return
    cfg = _STATE_EMAILS.get(new_status)
    if not cfg:
        return
    subject_tpl, template, emoji = cfg
    send_html_email(
        to_email=order.customer.email,
        subject=f"{subject_tpl.format(code=order.code)} {emoji}",
        template=template,
        ctx={
            'customer_name': order.customer.full_name,
            'order_code': order.code,
            'tracking_code': tracking_code,
            'status_code': new_status,
            'status_label': dict(
                (s, l) for s, l in [
                    ('PREPARING', 'Preparando'),
                    ('SHIPPED',   'Enviado'),
                    ('IN_TRANSIT','En tránsito'),
                    ('DELIVERED', 'Entregado'),
                    ('CANCELLED', 'Cancelado'),
                    ('REFUNDED',  'Devuelto'),
                    ('RETURNED',  'Devuelto'),
                    ('FAILED',    'Entrega fallida'),
                ]
            ).get(new_status, new_status),
            'tracking_url': f'/tracking?code={tracking_code}' if tracking_code else '',
            'emoji': emoji,
        },
    )


# Etiquetas legibles de estado (pedido y envío) para las notificaciones in-app.
_STATUS_LABELS = {
    'PENDING': 'Pendiente', 'PAID': 'Pagado', 'PREPARING': 'Preparando',
    'READY': 'Listo para envío', 'SHIPPED': 'Enviado', 'IN_TRANSIT': 'En tránsito',
    'DELIVERED': 'Entregado', 'CANCELLED': 'Cancelado', 'REFUNDED': 'Devuelto',
    'RETURNED': 'Devuelto', 'FAILED': 'Entrega fallida', 'CREATED': 'Creado',
}

# Estados que SÍ ameritan un correo al cliente (hitos). El resto solo in-app.
_CLIENT_EMAIL_STATUSES = {'DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'}


def notify_order_status_change(order, new_status, actor=None,
                              tracking_code='', notify_staff=True):
    """Sistema inteligente de notificaciones al cambiar el estado de un pedido.

    - IN-APP al CLIENTE (si tiene cuenta) en TODO cambio de estado.
    - IN-APP al staff (superadmin + admin de tienda + gerente de la sucursal) y
      al vendedor del pedido, salvo a quien realizó el cambio (actor).
    - EMAIL al cliente SOLO en hitos: entregado, cancelado o devolución.
    El afiliado NO se notifica aquí (solo en venta con su código y pago de comisión).
    """
    from .push import push_notification, staff_recipients

    label = _STATUS_LABELS.get(new_status, new_status)
    tenant = getattr(order, 'tenant', None)
    branch = getattr(order, 'branch', None)
    meta = {'order_id': order.pk, 'order_code': order.code, 'status': new_status}

    # 1) Cliente (in-app en su perfil)
    client_user = getattr(order.customer, 'user', None) if order.customer else None
    if client_user:
        try:
            push_notification(
                type='order_status',
                title=f'Tu pedido {order.code}',
                message=f'Tu pedido cambió a "{label}".',
                priority='P2',
                link='/account/orders',
                recipients=[client_user],
                tenant=tenant, branch=branch, meta=meta,
            )
        except Exception as e:
            print(f'[notify client status] {e}')

    # 2) Staff + vendedor (in-app), excluyendo al actor
    if notify_staff:
        try:
            recips = list(staff_recipients(tenant, branch))
            seller = getattr(order, 'seller', None)
            if seller and all(seller.id != u.id for u in recips):
                recips.append(seller)
            if actor:
                recips = [u for u in recips if u.id != actor.id]
            if recips:
                who = f'{actor.full_name} ' if actor else ''
                push_notification(
                    type='order',
                    title=f'Pedido {order.code} → {label}',
                    message=f'{who}actualizó el estado del pedido.',
                    priority='P3',
                    link=f'/app/admin/sales/{order.pk}',
                    recipients=recips,
                    tenant=tenant, branch=branch, meta=meta,
                )
        except Exception as e:
            print(f'[notify staff status] {e}')

    # 3) Email al cliente SOLO en hitos
    if new_status in _CLIENT_EMAIL_STATUSES:
        try:
            notify_order_state_change(order, new_status, tracking_code=tracking_code)
        except Exception as e:
            print(f'[email milestone] {e}')


def notify_password_reset(user, code):
    send_html_email(
        to_email=user.email,
        subject='Restablecer tu contraseña',
        template='password_reset',
        ctx={
            'user_name': user.full_name,
            'code': code,
        },
    )


def notify_welcome(user, code):
    send_html_email(
        to_email=user.email,
        subject='¡Bienvenido a Delux! Confirma tu cuenta',
        template='welcome',
        ctx={
            'user_name': user.full_name,
            'code': code,
        },
    )


def notify_pos_receipt(order):
    """Envía el comprobante de una venta POS al email del cliente (si es válido)."""
    from django.core.validators import validate_email
    from django.core.exceptions import ValidationError
    cust = getattr(order, 'customer', None)
    email = (getattr(cust, 'email', '') or '').strip()
    if not email:
        return
    try:
        validate_email(email)
    except ValidationError:
        return
    try:
        order_date = order.created_at.strftime('%d/%m/%Y %H:%M')
    except Exception:
        order_date = ''
    send_html_email(
        to_email=email,
        subject=f'Comprobante de tu compra {order.code} 🧾',
        template='pos_receipt',
        ctx={
            'customer_name': getattr(cust, 'full_name', '') or 'Cliente',
            'order_code': order.code,
            'order_date': order_date,
            'branch_name': getattr(order.branch, 'name', '') or '',
            'items': order.items.all(),
            'order_subtotal': order.subtotal,
            'order_tax': order.tax,
            'order_discount': order.discount,
            'order_total': order.total,
        },
    )


def notify_order_received(order):
    """Email al cliente con el comprobante (link PDF) y, si aplica, seguimiento."""
    import os
    cust = getattr(order, 'customer', None)
    if not cust or not getattr(cust, 'email', ''):
        return
    base = (os.getenv('FRONTEND_URL') or '').rstrip('/')
    receipt_url = f'{base}/api/v1/admin/checkout/receipt/{order.code}/'
    tracking_url = ''
    try:
        from apps.shipping.models import Shipment
        sh = Shipment.objects.filter(order=order).first()
        if sh:
            tracking_url = f'{base}/tracking/{sh.tracking_code}'
    except Exception:
        pass
    send_html_email(
        to_email=cust.email,
        subject=f'Recibimos tu pedido {order.code} 🛍️',
        template='order_receipt',
        ctx={
            'customer_name': getattr(cust, 'full_name', '') or 'Cliente',
            'order_code': order.code,
            'order_total': order.total,
            'branch_name': getattr(order.branch, 'name', '') or '',
            'receipt_url': receipt_url,
            'tracking_url': tracking_url,
        },
    )


def notify_affiliate_commission(commission):
    """Email al afiliado cuando gana una nueva comision."""
    aff = getattr(commission, 'affiliate', None)
    email = (getattr(aff, 'email', '') or '').strip()
    if not email:
        return
    order = getattr(commission, 'order', None)
    send_html_email(
        to_email=email,
        subject='¡Ganaste una comisión! 💸',
        template='affiliate_commission',
        ctx={
            'affiliate_name': getattr(aff, 'full_name', '') or 'Afiliado',
            'ref_code': getattr(aff, 'ref_code', '') or '',
            'order_code': getattr(order, 'code', '') or '',
            'base_amount': commission.base_amount,
            'rate': commission.rate,
            'amount': commission.amount,
        },
    )


def notify_affiliate_payout(payout):
    """Email al afiliado cuando se le registra un pago de comisiones."""
    aff = getattr(payout, 'affiliate', None)
    email = (getattr(aff, 'email', '') or '').strip()
    if not email:
        return
    try:
        paid_date = payout.created_at.strftime('%d/%m/%Y %H:%M')
    except Exception:
        paid_date = ''
    send_html_email(
        to_email=email,
        subject=f'Registramos tu pago de comisiones ✅',
        template='affiliate_payout',
        ctx={
            'affiliate_name': getattr(aff, 'full_name', '') or 'Afiliado',
            'ref_code': getattr(aff, 'ref_code', '') or '',
            'amount': payout.amount,
            'method_label': payout.get_method_display(),
            'reference': payout.reference or '',
            'commissions_count': payout.commissions_count,
            'paid_date': paid_date,
        },
    )
