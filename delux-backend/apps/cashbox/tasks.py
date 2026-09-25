"""Tareas Celery de caja.

Al cerrar un turno se manda el arqueo por correo a los gerentes de esa
sucursal, con el PDF adjunto. Va en segundo plano para que el cierre en
pantalla no espere al servidor de correo.
"""
import logging
from smtplib import (
    SMTPDataError, SMTPNotSupportedError, SMTPRecipientsRefused,
    SMTPSenderRefused,
)

from celery import shared_task

logger = logging.getLogger(__name__)

#: Fallos que NO se reintentan: el servidor rechazo el mensaje de forma
#: definitiva (direccion inexistente, remitente no permitido, contenido
#: rechazado). Reintentar da exactamente el mismo error, asi que se registra
#: y se abandona. Todo lo demas —SMTP caido, timeout, DNS— si se reintenta.
PERMANENT_SMTP_ERRORS = (
    SMTPRecipientsRefused,   # ningun destinatario fue aceptado
    SMTPSenderRefused,       # el remitente configurado no es valido
    SMTPNotSupportedError,   # el servidor no soporta lo que se le pide
)


def _is_permanent(exc: Exception) -> bool:
    """True si volver a intentar el envio daria el mismo resultado."""
    if isinstance(exc, PERMANENT_SMTP_ERRORS):
        return True
    # 5xx es rechazo definitivo; 4xx es "ahora no, prueba luego".
    if isinstance(exc, SMTPDataError):
        return 500 <= (exc.smtp_code or 0) < 600
    return False


def supervisor_emails(session) -> list[str]:
    """Correos que reciben el arqueo: los gerentes de ESA sucursal.

    A proposito no incluye a los superadmins: el arqueo es del dia a dia de la
    tienda y lo revisa quien la maneja. Se ignora a quien no tenga correo o
    este inactivo, y se evitan duplicados.
    """
    from apps.accounts.models import Role, User

    qs = User.objects.filter(
        is_active=True, role=Role.BRANCH_MANAGER, branch_id=session.branch_id,
    ).exclude(email='')
    if getattr(session, 'tenant_id', None):
        qs = qs.filter(tenant_id=session.tenant_id)

    seen, out = set(), []
    for u in qs:
        mail = (u.email or '').strip()
        if mail and mail.lower() not in seen:
            seen.add(mail.lower())
            out.append(mail)
    return out


def _html_body(session, kind: str, title: str, detail: str) -> str:
    """Cuerpo del correo, sobre el layout de correos de la plataforma."""
    from apps.notifications.services import render_email

    from .pdf import _money, _dt, _person

    # (texto, borde/degradado, fondo, icono) segun como cerro la caja.
    accent_dark, accent, accent_bg, icon = {
        'ok':    ('#047857', '#059669', '#ecfdf5', '\u2713'),
        'short': ('#b91c1c', '#dc2626', '#fef2f2', '\u26a0'),
        'over':  ('#1d4ed8', '#3b82f6', '#eff6ff', '\u26a0'),
    }[kind]

    return render_email('cash_close', {
        'code': session.code or session.id,
        'branch': getattr(session.branch, 'name', '') or '\u2014',
        'register': getattr(session.register, 'name', '') or '\u2014',
        'seller': _person(session.closed_by),
        'closed_at': _dt(session.closed_at),
        'expected': _money(session.expected_amount),
        'counted': _money(session.counted_amount),
        'closing_note': session.closing_note,
        'outcome_title': title,
        'outcome_detail': detail,
        'accent': accent,
        'accent_dark': accent_dark,
        'accent_bg': accent_bg,
        'icon': icon,
    })


@shared_task(bind=True, max_retries=3, default_retry_delay=180)
def send_cash_close_email_task(self, session_id):
    """Manda el arqueo del turno a los gerentes de la sucursal, con el PDF."""
    from apps.settings.email import send_platform_email
    from .models import CashSession
    from .pdf import build_cash_close_pdf, close_outcome

    session = (CashSession.objects
               .select_related('branch', 'register', 'opened_by', 'closed_by')
               .filter(id=session_id).first())
    if not session or session.status != CashSession.Status.CLOSED:
        return

    to = supervisor_emails(session)
    if not to:
        return

    kind, title, detail = close_outcome(session)
    branch = getattr(session.branch, 'name', '')
    prefijo = {'ok': 'Caja cuadrada', 'short': 'FALTANTE en caja',
               'over': 'SOBRANTE en caja'}[kind]
    subject = f'{prefijo} — {branch} — turno {session.code or session.id}'

    try:
        pdf = build_cash_close_pdf(session)
        send_platform_email(
            to=to,
            subject=subject,
            body=_html_body(session, kind, title, detail),
            html=True,
            attachments=[(f'cierre-caja-{session.code or session.id}.pdf',
                          pdf, 'application/pdf')],
        )
    except Exception as exc:
        # Rechazo definitivo (direccion inexistente, remitente invalido): no
        # se reintenta, solo queda en el log. El cierre ya esta guardado.
        if _is_permanent(exc):
            logger.warning('Arqueo %s: correo rechazado para %s (%s)',
                           session_id, ', '.join(to), exc)
            return
        # Fallo pasajero (SMTP caido, timeout): hasta 3 reintentos. Al agotarlos
        # Celery lanza MaxRetriesExceededError y se deja de insistir.
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error('Arqueo %s: no se pudo enviar tras %s reintentos (%s)',
                         session_id, self.max_retries, exc)
