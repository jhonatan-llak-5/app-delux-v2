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
