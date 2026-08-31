"""Lógica de negocio de la caja: apertura, arqueo y cierre.

Las vistas solo orquestan; aquí vive el cálculo del efectivo esperado, que es
la parte delicada del módulo.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from .models import (
    CashCountLine, CashMovement, CashRegister, CashSession, CountStage,
    DENOMINATIONS, PieceType,
)

ZERO = Decimal('0.00')

# Formas de pago del SRI (Order.payment_form) agrupadas por cómo afectan al
# cajón: solo el efectivo entra físicamente en la caja.
FORM_CASH = '01'
FORMS_CARD = ('16', '19')
FORM_TRANSFER = '20'

# Pares (pieza, denominación) aceptados en un conteo.
_VALID_PIECES = {(p, d) for p, d in DENOMINATIONS}


def _d(v) -> Decimal:
    """Normaliza a Decimal con 2 decimales (None -> 0.00)."""
    return (Decimal(str(v or 0))).quantize(Decimal('0.01'))


# ─────────────────────────────────────────────
# Puntos de venta
# ─────────────────────────────────────────────
def default_register(tenant, branch) -> CashRegister:
    """Punto de venta por defecto de la sucursal; se crea la primera vez que
    alguien abre caja para no obligar a configurar nada antes de vender."""
    reg = CashRegister.objects.filter(branch=branch, is_active=True).order_by('id').first()
    if reg:
        return reg
    return CashRegister.objects.create(tenant=tenant, branch=branch, name='Caja 1')


# ─────────────────────────────────────────────
# Conteo de billetes y monedas
# ─────────────────────────────────────────────
def apply_count(session: CashSession, stage: str, lines) -> Decimal:
    """Guarda (reemplazando) el conteo de una etapa y devuelve su total."""
    CashCountLine.objects.filter(session=session, stage=stage).delete()
    total = ZERO
    rows = []
    for ln in lines or []:
        piece = (ln.get('piece') or PieceType.BILL)
        denom = _d(ln.get('denomination'))
        qty = int(ln.get('quantity') or 0)
        if qty <= 0:
            continue
        if (piece, denom) not in _VALID_PIECES:
            raise ValueError(f'Denominación no válida: {piece} {denom}')
        rows.append(CashCountLine(
            tenant=session.tenant, session=session, stage=stage,
            piece=piece, denomination=denom, quantity=qty,
        ))
        total += denom * qty
    CashCountLine.objects.bulk_create(rows)
    return _d(total)


def count_breakdown(session: CashSession, stage: str) -> list[dict]:
    """Conteo de una etapa con TODAS las denominaciones (las no contadas van en
    0) para que el frontend pinte la tabla completa sin lógica extra."""
    saved = {
        (l.piece, l.denomination): l.quantity
        for l in session.count_lines.filter(stage=stage)
    }
    out = []
    for piece, denom in DENOMINATIONS:
        qty = saved.get((piece, denom), 0)
        out.append({
            'piece': piece,
            'denomination': str(denom),
            'quantity': qty,
            'subtotal': str(_d(denom * qty)),
        })
    return out


# ─────────────────────────────────────────────
# Turno
# ─────────────────────────────────────────────
def open_session(*, tenant, branch, register, user, opening_lines=None,
                 opening_amount=None, note='') -> CashSession:
    """Abre un turno. El fondo inicial sale del conteo si se envía; si no, del
    monto suelto (para aperturas rápidas sin desglose)."""
    if register is None:
        register = default_register(tenant, branch)
    if register.branch_id != branch.id:
        raise ValueError('El punto de venta no pertenece a esa sucursal.')
    if CashSession.objects.filter(register=register, status=CashSession.Status.OPEN).exists():
        raise ValueError(f'{register.name} ya tiene una caja abierta. Ciérrala antes de abrir otra.')

    with transaction.atomic():
        today = timezone.localtime().strftime('%Y%m%d')
        seq = CashSession.objects.filter(
            tenant=tenant, code__startswith=f'CAJA-{today}-').count() + 1
        session = CashSession.objects.create(
            tenant=tenant, code=f'CAJA-{today}-{seq:03d}',
            branch=branch, register=register,
            opened_by=user, opened_at=timezone.now(),
            opening_note=(note or '')[:300],
        )
        if opening_lines:
            session.opening_amount = apply_count(session, CountStage.OPENING, opening_lines)
        else:
            session.opening_amount = _d(opening_amount)
        session.save(update_fields=['opening_amount', 'updated_at'])
    return session


def session_for_sale(user, branch_id) -> CashSession | None:
    """Turno al que se debe imputar una venta POS.

    Primero el turno propio del vendedor en esa sucursal; si no tiene, el único
    turno abierto de la sucursal. Con varias cajas abiertas y ninguna del
    vendedor no se adivina: la venta queda sin turno y no descuadra a nadie.
    """
    if not branch_id or not getattr(user, 'is_authenticated', False):
        return None
    qs = CashSession.objects.filter(status=CashSession.Status.OPEN, branch_id=branch_id)
    own = qs.filter(opened_by=user).first()
    if own:
        return own
    return qs.first() if qs.count() == 1 else None


def compute_totals(session: CashSession) -> dict:
    """Movimientos del turno y efectivo esperado en el cajón, en vivo."""
    from apps.expenses.models import Expense
    from apps.orders.models import Order, OrderStatus
    from apps.returns.models import SaleChange

    orders = (Order.objects
              .filter(cash_session=session)
              .exclude(status__in=[OrderStatus.CANCELLED, OrderStatus.REFUNDED]))
    agg = orders.aggregate(n=Count('id'), total=Sum('total'))
    sales_total = _d(agg['total'])
    by_form = {r['payment_form']: _d(r['t'])
               for r in orders.values('payment_form').annotate(t=Sum('total'))}

    cash_sales = by_form.get(FORM_CASH, ZERO)
    card_sales = sum((by_form.get(f, ZERO) for f in FORMS_CARD), ZERO)
    transfer_sales = by_form.get(FORM_TRANSFER, ZERO)
    other_sales = _d(sales_total - cash_sales - card_sales - transfer_sales)

    # Cambios y devoluciones de dinero registrados EN este turno (aunque la venta
    # original sea de otro día): la diferencia entra (el cliente paga) o sale (se
    # le devuelve). Solo cuenta lo movido en EFECTIVO: tarjeta y transferencia
    # quedan en el balance pero no pasan por el cajón.
    change_in, change_out = ZERO, ZERO
    for diff in (SaleChange.objects
                 .filter(cash_session=session, annulled=False, payment_method='CASH')
                 .values_list('difference', flat=True)):
        d = _d(diff)
        if d > 0:
            change_in += d
        else:
            change_out += -d

    expenses_cash = _d(
        Expense.objects.filter(cash_session=session, payment_method='CASH')
        .aggregate(t=Sum('amount'))['t'])

    mov = session.movements.values('type').annotate(t=Sum('amount'))
    mov_map = {m['type']: _d(m['t']) for m in mov}
    cash_in = mov_map.get(CashMovement.Type.IN, ZERO)
    cash_out = mov_map.get(CashMovement.Type.OUT, ZERO)

    expected = _d(
        _d(session.opening_amount)
        + cash_sales + change_in + cash_in
        - change_out - cash_out - expenses_cash
    )

    return {
        'sales_count': agg['n'] or 0,
        'sales_total': sales_total,
        'cash_sales': cash_sales,
        'card_sales': card_sales,
        'transfer_sales': transfer_sales,
        'other_sales': other_sales,
        'change_in': change_in,
        'change_out': change_out,
        'expenses_cash': expenses_cash,
        'cash_in': cash_in,
        'cash_out': cash_out,
        # Todo lo que entró al negocio en el turno (no solo efectivo).
        'total_income': _d(sales_total + change_in + cash_in),
        'total_outflow': _d(change_out + cash_out + expenses_cash),
        'expected_amount': expected,
    }


def close_session(*, session: CashSession, user, closing_lines=None,
                  counted_amount=None, note='') -> CashSession:
    """Cierra el turno: guarda el conteo final, congela los totales y deja el
    descuadre calculado."""
    if session.status != CashSession.Status.OPEN:
        raise ValueError('Esta caja ya está cerrada.')

    with transaction.atomic():
        if closing_lines:
            counted = apply_count(session, CountStage.CLOSING, closing_lines)
        else:
            counted = _d(counted_amount)

        totals = compute_totals(session)
        for field, value in totals.items():
            if hasattr(session, field):
                setattr(session, field, value)

        session.counted_amount = counted
        session.difference = _d(counted - totals['expected_amount'])
        session.closing_note = (note or '')[:300]
        session.closed_by = user
        session.closed_at = timezone.now()
        session.status = CashSession.Status.CLOSED
        session.save()
    return session


def record_auto_movement(*, user, branch_id, type_, amount, reason,
                         source_session_id=None) -> CashMovement | None:
    """Registra automáticamente un movimiento de efectivo en el turno abierto.

    Lo usan los flujos que mueven plata del cajón fuera de una venta POS:
    devoluciones, anulaciones y nómina pagada en efectivo.

    `source_session_id` evita contar dos veces: si el dinero corresponde a una
    venta del MISMO turno abierto, `compute_totals` ya la descuenta al excluir la
    orden anulada, así que no se genera movimiento. Solo se registra cuando la
    plata sale hoy por algo de otro turno (o de una venta web).

    Nunca valida el saldo disponible ni lanza: un reembolso legítimo no puede
    quedar bloqueado porque en el cajón haya menos de lo que se devuelve.
    """
    amt = _d(amount)
    if amt <= 0:
        return None
    session = session_for_sale(user, branch_id)
    if session is None:
        return None
    if source_session_id is not None and source_session_id == session.id:
        return None
    return CashMovement.objects.create(
        tenant=session.tenant, session=session, type=type_,
        amount=amt, reason=(reason or '')[:200], created_by=user,
    )


def register_movement(*, session: CashSession, user, type_, amount, reason='') -> CashMovement:
    """Ingreso o retiro manual de efectivo en un turno abierto."""
    if session.status != CashSession.Status.OPEN:
        raise ValueError('No se pueden registrar movimientos en una caja cerrada.')
    amt = _d(amount)
    if amt <= 0:
        raise ValueError('El monto debe ser mayor a cero.')
    if type_ not in (CashMovement.Type.IN, CashMovement.Type.OUT):
        raise ValueError('Tipo de movimiento no válido.')
    if type_ == CashMovement.Type.OUT:
        available = compute_totals(session)['expected_amount']
        if amt > available:
            raise ValueError(
                f'No puedes retirar ${amt}: en la caja solo hay ${available}.')
    return CashMovement.objects.create(
        tenant=session.tenant, session=session, type=type_,
        amount=amt, reason=(reason or '')[:200], created_by=user,
    )
