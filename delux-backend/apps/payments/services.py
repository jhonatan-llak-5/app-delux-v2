"""Helpers para integración PayPhone (sandbox-friendly)."""
import requests
import secrets
from decimal import Decimal

from apps.settings.models import PlatformSettings
from .models import Payment, PaymentMethod, PaymentStatus


def init_payphone_transaction(order, return_url: str) -> dict:
    settings_obj = PlatformSettings.load()
    amount_cents = int((order.total * Decimal('100')).quantize(Decimal('1')))
    reference = f'DLX-{order.code}-{secrets.token_hex(4).upper()}'

    payment = Payment.objects.create(
        tenant=order.tenant, order=order,
        method=PaymentMethod.PAYPHONE,
        status=PaymentStatus.PENDING,
        amount=order.total,
        external_id=reference,
        raw_payload={'reference': reference, 'return_url': return_url},
    )

    if (not settings_obj.payphone_enabled
            or settings_obj.payphone_sandbox
            or not settings_obj.payphone_token):
        return {
            'payment_url': f'/checkout/payphone/sandbox?ref={reference}&payment={payment.id}',
            'reference': reference,
            'payment_id': payment.id,
            'sandbox': True,
        }

    try:
        resp = requests.post(
            f'{settings_obj.payphone_api_url}/Sale/Prepare',
            headers={
                'Authorization': f'Bearer {settings_obj.payphone_token}',
                'Content-Type': 'application/json',
            },
            json={
                'amount': amount_cents,
                'amountWithoutTax': amount_cents,
                'currency': 'USD',
                'storeId': settings_obj.payphone_store_id,
                'reference': reference,
                'clientUserId': str(order.customer_id or 0),
                'responseUrl': return_url,
                'cancellationUrl': return_url,
            },
            timeout=15,
        )
        data = resp.json()
        if resp.status_code != 200:
            payment.status = PaymentStatus.FAILED
            payment.raw_payload = data
            payment.save(update_fields=['status', 'raw_payload'])
            return {'error': data.get('message', 'PayPhone error'), 'payment_id': payment.id}
        payment.raw_payload.update(data)
        payment.save(update_fields=['raw_payload'])
        return {
            'payment_url': data.get('paymentUrl') or data.get('payWithCard'),
            'reference': reference,
            'payment_id': payment.id,
            'sandbox': False,
        }
    except Exception as e:
        payment.status = PaymentStatus.FAILED
        payment.raw_payload = {'error': str(e)}
        payment.save(update_fields=['status', 'raw_payload'])
        return {'error': str(e), 'payment_id': payment.id}


def _safe_notify_paid(order):
    from apps.notifications.services import notify_order_paid
    notify_order_paid(order)


def _safe_broadcast_sale(order):
    from apps.notifications.broadcast import notify_new_sale
    notify_new_sale(order)


def confirm_payment(payment, success: bool, raw: dict | None = None):
    from apps.orders.models import Order, OrderStatus
    payment.status = PaymentStatus.SUCCEEDED if success else PaymentStatus.FAILED
    if raw:
        payment.raw_payload.update(raw)
    payment.save(update_fields=['status', 'raw_payload'])

    if success:
        order = payment.order
        order.status = OrderStatus.PAID
        order.save(update_fields=['status', 'updated_at'])
        try: _safe_notify_paid(order)
        except Exception as e: print(f'[notify_order_paid] {e}')
        try: _safe_broadcast_sale(order)
        except Exception as e: print(f'[broadcast_new_sale] {e}')
    return payment
