from decimal import Decimal

from django.db import transaction

from apps.accounts.models import User, Role
from apps.branches.models import Branch
from .models import PayrollRun, PayrollItem, PayrollStatus, PayItemStatus

EMPLOYEE_ROLES = [Role.SALESPERSON]


@transaction.atomic
def generate_payroll(tenant, year, month, branch=None, user=None):
    """Crea la nomina (pendiente) de un mes con un renglon por vendedor activo."""
    if tenant is None:
        from apps.tenants.models import Tenant
        tenant = Tenant.objects.filter(is_active=True).first()
        if tenant is None:
            raise ValueError('No hay una tienda configurada.')
    if PayrollRun.objects.filter(tenant=tenant, branch=branch, year=year, month=month).exists():
        raise ValueError('Ya existe una nomina para ese mes y sucursal.')

    employees = User.objects.filter(tenant=tenant, role__in=EMPLOYEE_ROLES, is_active=True)
    if branch is not None:
        employees = employees.filter(branch=branch)
    employees = list(employees.order_by('full_name'))
    if not employees:
        raise ValueError('No hay vendedores activos para generar la nomina.')

    run = PayrollRun.objects.create(
        tenant=tenant, year=year, month=month, branch=branch,
        status=PayrollStatus.PENDING, generated_by=user,
    )
    total = Decimal('0')
    for e in employees:
        base = Decimal(str(getattr(e, 'monthly_salary', 0) or 0))
        PayrollItem.objects.create(
            tenant=tenant, run=run, employee=e,
            employee_name=e.full_name or e.username,
            role=e.role, base_salary=base, adjustment=Decimal('0'),
            amount=base, status=PayItemStatus.PENDING,
        )
        total += base
    run.total_amount = total
    run.save(update_fields=['total_amount', 'updated_at'])
    return run


def recompute_run_status(run):
    """Actualiza el estado de la nomina segun sus renglones."""
    items = run.items.all()
    total = items.count()
    paid = items.filter(status=PayItemStatus.PAID).count()
    if total and paid == total:
        run.status = PayrollStatus.PAID
    elif paid == 0:
        run.status = PayrollStatus.PENDING
    else:
        run.status = PayrollStatus.PARTIAL
    run.save(update_fields=['status', 'updated_at'])
    return run.status


def _cash_out_for_payroll(item, user):
    """Un sueldo pagado en efectivo sale del cajón: se registra en el turno
    abierto para que el cierre cuadre."""
    if (item.method or '') != 'CASH':
        return
    from apps.cashbox.models import CashMovement
    from apps.cashbox.services import record_auto_movement
    branch_id = item.run.branch_id or getattr(item.employee, 'branch_id', None)
    record_auto_movement(
        user=user, branch_id=branch_id,
        type_=CashMovement.Type.OUT, amount=item.amount,
        reason=f'Nómina {item.run.month:02d}/{item.run.year} — {item.employee_name}',
    )


@transaction.atomic
def pay_item(item, method='CASH', notes='', user=None):
    from django.utils import timezone
    item.status = PayItemStatus.PAID
    item.method = method or 'CASH'
    item.notes = notes or ''
    item.paid_at = timezone.now()
    item.save(update_fields=['status', 'method', 'notes', 'paid_at', 'updated_at'])
    recompute_run_status(item.run)
    _cash_out_for_payroll(item, user)
    return item


@transaction.atomic
def unpay_item(item):
    item.status = PayItemStatus.PENDING
    item.method = ''
    item.paid_at = None
    item.save(update_fields=['status', 'method', 'paid_at', 'updated_at'])
    recompute_run_status(item.run)
    return item


@transaction.atomic
def pay_all(run, method='CASH', user=None):
    from django.utils import timezone
    now = timezone.now()
    pending = list(run.items.filter(status=PayItemStatus.PENDING))
    run.items.filter(status=PayItemStatus.PENDING).update(
        status=PayItemStatus.PAID, method=(method or 'CASH'), paid_at=now, updated_at=now)
    recompute_run_status(run)
    for it in pending:
        it.method = method or 'CASH'
        _cash_out_for_payroll(it, user)
    return run
