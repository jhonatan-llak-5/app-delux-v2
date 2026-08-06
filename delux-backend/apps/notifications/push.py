"""Servicio unificado de notificaciones: persiste (1 fila por destinatario) y
emite por WebSocket al grupo de cada usuario (notif_user_<id>)."""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Q

from .models import Notification


def _payload(n: Notification) -> dict:
    return {
        'id': n.id,
        'type': n.type,
        'priority': n.priority,
        'title': n.title,
        'message': n.message,
        'link': n.link,
        'meta': n.meta or {},
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
    }


def push_notification(*, type: str, title: str, priority: str = 'P2',
                      message: str = '', link: str = '', meta: dict | None = None,
                      recipients, tenant=None, branch=None):
    """Crea una notificación para cada destinatario y la emite en vivo."""
    # Deduplicar destinatarios por id
    users = list({u.id: u for u in recipients if u and getattr(u, 'id', None)}.values())
    if not users:
        return []

    # Fase 4: excluir a quienes deshabilitaron este tipo en sus preferencias.
    from .models import NotificationPreference
    prefs = {
        pk: (dis or [])
        for pk, dis in NotificationPreference.objects
        .filter(user_id__in=[u.id for u in users])
        .values_list('user_id', 'disabled_types')
    }
    users = [u for u in users if type not in prefs.get(u.id, [])]
    if not users:
        return []

    rows = [
        Notification(
            recipient=u, tenant=tenant, branch=branch, type=type,
            priority=priority, title=title, message=message,
            link=link or '', meta=meta or {},
        )
        for u in users
    ]
    Notification.objects.bulk_create(rows)

    layer = get_channel_layer()
    if layer:
        for n in rows:
            try:
                async_to_sync(layer.group_send)(
                    f'notif_user_{n.recipient_id}',
                    {'type': 'notify', 'payload': _payload(n)},
                )
            except Exception:
                pass
    return rows


# ── Resolución de destinatarios ─────────────────────────────────────────────

def staff_recipients(tenant, branch=None):
    """Staff que debe ver un evento operativo de una sucursal/tenant:
    superadmins (globales) + admins del tenant + gerente(s) de esa sucursal."""
    from apps.accounts.models import User, Role

    conds = Q(role=Role.SUPERADMIN)
    if tenant is not None:
        mgr = Q(role=Role.BRANCH_MANAGER) & Q(tenant=tenant)
        if branch is not None:
            mgr &= Q(branch=branch)
        conds |= mgr
    return list(User.objects.filter(Q(is_active=True) & conds).distinct())


def admin_recipients(tenant=None):
    """Administradores para eventos NO ligados a una sucursal (p. ej. afiliado
    nuevo, que es global): superadmins + admins de tenant. Si se pasa tenant,
    limita los admins a ese tenant; si no, todos los admins de tenant."""
    from apps.accounts.models import User, Role

    conds = Q(role=Role.SUPERADMIN)
    mgr = Q(role=Role.BRANCH_MANAGER)
    if tenant is not None:
        mgr &= Q(tenant=tenant)
    conds |= mgr
    return list(User.objects.filter(Q(is_active=True) & conds).distinct())
