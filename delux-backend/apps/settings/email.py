"""
Helpers de envio de correo usando la configuracion SMTP del superadmin.
Construye conexion SMTP en runtime a partir de PlatformSettings.
"""
from __future__ import annotations
from typing import Iterable

from django.core.mail import EmailMessage, get_connection

from .models import PlatformSettings


def send_platform_email(
    to: Iterable[str],
    subject: str,
    body: str,
    *,
    html: bool = False,
    cc: Iterable[str] | None = None,
    bcc: Iterable[str] | None = None,
) -> int:
    s = PlatformSettings.load()

    if not s.smtp_host:
        connection = get_connection(
            backend='django.core.mail.backends.console.EmailBackend'
        )
    else:
        connection = get_connection(
            backend='django.core.mail.backends.smtp.EmailBackend',
            host=s.smtp_host,
            port=s.smtp_port,
            username=s.smtp_username,
            password=s.smtp_password,
            use_tls=s.smtp_use_tls,
            use_ssl=s.smtp_use_ssl,
        )

    from_email = f'{s.default_from_name} <{s.default_from_email}>'
    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=from_email,
        to=list(to),
        cc=list(cc) if cc else None,
        bcc=list(bcc) if bcc else None,
        connection=connection,
    )
    if html:
        msg.content_subtype = 'html'
    return msg.send(fail_silently=False)
