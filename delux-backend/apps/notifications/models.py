"""Notificaciones persistentes (una fila por destinatario)."""
from django.conf import settings
from django.db import models


class NotifPriority(models.TextChoices):
    P1 = 'P1', 'Urgente'      # venta, pedido, stock — con sonido fuerte
    P2 = 'P2', 'Importante'   # afiliado, reseña, devolución — sonido suave
    P3 = 'P3', 'Informativa'  # cliente nuevo, nómina — sin sonido


class Notification(models.Model):
    """Notificación dirigida a UN usuario. Persistida para historial + leído/no."""
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notifications')

    # Contexto (para filtrar/limpiar y mostrar origen)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE,
                               null=True, blank=True, related_name='+')
    branch = models.ForeignKey('branches.Branch', on_delete=models.SET_NULL,
                               null=True, blank=True, related_name='+')

    type = models.CharField(max_length=40)                    # sale, order, low_stock, affiliate_commission…
    priority = models.CharField(max_length=2, choices=NotifPriority.choices,
                                default=NotifPriority.P2)
    title = models.CharField(max_length=160)
    message = models.CharField(max_length=400, blank=True)
    link = models.CharField(max_length=200, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', '-created_at']),
        ]

    def __str__(self):
        return f'[{self.type}] {self.title} -> {self.recipient_id}'


class NotificationPreference(models.Model):
    """Preferencias de notificaciones por usuario (Fase 4)."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='notif_pref')
    # Sonido global (el usuario puede silenciar todo el audio).
    sound_enabled = models.BooleanField(default=True)
    # Tipos que el usuario NO desea recibir (ej. ['review', 'user_registered']).
    disabled_types = models.JSONField(default=list, blank=True)
    # "No molestar": rango horario en el que NO suena (sigue guardandose).
    dnd_start = models.TimeField(null=True, blank=True)
    dnd_end = models.TimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'pref<{self.user_id}>'
