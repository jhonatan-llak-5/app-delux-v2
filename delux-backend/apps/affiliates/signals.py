from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.orders.models import Order
from .services import sync_commission_for_order


@receiver(post_save, sender=Order)
def order_commission_sync(sender, instance, **kwargs):
    try:
        sync_commission_for_order(instance)
    except Exception as e:  # nunca romper el guardado del pedido
        print(f'[commission_sync] {e}')
