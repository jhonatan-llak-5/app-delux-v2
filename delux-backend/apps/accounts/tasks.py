"""Tareas Celery para envio de correos transaccionales con templates HTML modernos."""
from celery import shared_task


@shared_task
def send_activation_email(user_email: str, name: str, code: str, minutes: int = 15) -> None:
    from apps.notifications.services import send_html_email
    send_html_email(
        to_email=user_email,
        subject='Activa tu cuenta en Delux ✨',
        template='welcome',
        ctx={'user_name': name or 'cliente', 'code': code},
        text_fallback=f'Tu codigo es: {code}',
    )


@shared_task
def send_password_reset_email(user_email: str, name: str, code: str, minutes: int = 30) -> None:
    from apps.notifications.services import send_html_email
    send_html_email(
        to_email=user_email,
        subject='Restablece tu contraseña',
        template='password_reset',
        ctx={'user_name': name or 'cliente', 'code': code},
        text_fallback=f'Tu codigo es: {code}',
    )
