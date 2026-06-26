"""Tareas Celery para envio de correos transaccionales con templates HTML modernos."""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


def dispatch(task, *args, **kwargs) -> None:
    """Encola la tarea en Celery; si el broker no esta disponible (Redis/RabbitMQ
    caido o sin configurar), la ejecuta de forma sincrona para no romper la
    peticion HTTP. Cualquier fallo de envio se registra pero NUNCA se propaga,
    de modo que el registro/recuperacion de cuenta siempre responde bien.
    """
    try:
        task.delay(*args, **kwargs)
        return
    except Exception:
        logger.warning(
            'Broker Celery no disponible; ejecutando %s en linea.',
            getattr(task, 'name', task), exc_info=True,
        )
    try:
        task.run(*args, **kwargs)
    except Exception:
        logger.exception(
            'Fallo enviando correo (%s) en linea.', getattr(task, 'name', task),
        )


@shared_task
def send_activation_email(user_email: str, name: str, code: str, minutes: int = 15) -> None:
    from apps.notifications.services import send_html_email
    send_html_email(
        to_email=user_email,
        subject='Activa tu cuenta en Delux ✨',
        template='activation',
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


@shared_task
def send_staff_credentials_email(user_email: str, name: str, password: str,
                                 role_label: str = '', branch_name: str = '',
                                 login_url: str = '') -> None:
    from apps.notifications.services import send_html_email
    send_html_email(
        to_email=user_email,
        subject='Tus credenciales de acceso a Delux \U0001f511',
        template='staff_credentials',
        ctx={
            'user_name': name or 'colaborador',
            'email': user_email,
            'password': password,
            'role_label': role_label or 'Colaborador',
            'branch_name': branch_name,
            'login_url': login_url,
        },
        text_fallback=f'Email: {user_email} | Contraseña: {password}',
    )
