"""Helper para enviar broadcasts a grupos WebSocket."""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_admin(payload: dict):
    """Envía payload a todos los admins conectados."""
    layer = get_channel_layer()
    if not layer:
        return
    try:
        async_to_sync(layer.group_send)(
            'admin_notifications',
            {'type': 'notify', 'payload': payload},
        )
    except Exception as e:
        print(f'[broadcast] {e}')


def notify_new_sale(order):
    broadcast_admin({
        'type': 'new_sale',
        'title': '💰 Nueva venta',
        'message': f'Orden {order.code} - ${order.total} ({order.branch.name})',
        'order_id': order.id,
        'order_code': order.code,
        'order_total': str(order.total),
        'branch_name': order.branch.name,
        'channel': order.channel,
    })


def notify_low_stock(stock):
    broadcast_admin({
        'type': 'low_stock',
        'title': '⚠️ Stock crítico',
        'message': f'{stock.variant.product.name} ({stock.variant.sku}) en {stock.branch.name}: {stock.quantity} unidades',
        'product_id': stock.variant.product.id,
        'branch_id': stock.branch.id,
        'quantity': stock.quantity,
    })
