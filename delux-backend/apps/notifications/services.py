"""Envío de emails transaccionales usando SMTP de PlatformSettings."""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from django.template.loader import render_to_string

from apps.settings.models import PlatformSettings


def send_html_email(to_email: str, subject: str, template: str, ctx: dict, text_fallback: str = ''):
    """Envia email HTML usando SMTP configurado en PlatformSettings."""
    s = PlatformSettings.load()
    if not s.smtp_host:
        # Sin SMTP configurado, log y salir
        print(f'[email skipped] {subject} → {to_email}')
        return False

    html = render_to_string(f'emails/{template}.html', {
        **ctx,
        'platform_name': s.platform_name,
        'platform_tagline': s.platform_tagline,
        'support_email': s.support_email,
    })

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'{s.default_from_name} <{s.default_from_email}>'
    msg['To'] = to_email
    msg.attach(MIMEText(text_fallback or subject, 'plain', 'utf-8'))
    msg.attach(MIMEText(html, 'html', 'utf-8'))

    try:
        if s.smtp_use_ssl:
            smtp = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15)
        else:
            smtp = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15)
            if s.smtp_use_tls:
                smtp.starttls()
        if s.smtp_username:
            smtp.login(s.smtp_username, s.smtp_password)
        smtp.sendmail(s.default_from_email, [to_email], msg.as_string())
        smtp.quit()
        return True
    except Exception as e:
        print(f'[email error] {subject} → {to_email}: {e}')
        return False


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
_STATE_EMAILS = {
    'PREPARING':  ('Preparamos tu orden {code}', 'order_state', '📦'),
    'SHIPPED':    ('Tu orden {code} está en camino', 'order_state', '🚚'),
    'IN_TRANSIT': ('Tu orden {code} va en ruta', 'order_state', '🛣️'),
    'DELIVERED':  ('¡Tu orden {code} fue entregada!', 'order_state', '✅'),
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
                ]
            ).get(new_status, new_status),
            'tracking_url': f'/tracking?code={tracking_code}' if tracking_code else '',
            'emoji': emoji,
        },
    )


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
