from rest_framework import serializers

from .models import CashMovement, CashRegister, CashSession, CountStage
from .services import count_breakdown


class CashRegisterSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    has_open_session = serializers.SerializerMethodField()

    class Meta:
        model = CashRegister
        fields = ['id', 'branch', 'branch_name', 'name', 'is_active', 'has_open_session']

    def get_has_open_session(self, obj) -> bool:
        return obj.sessions.filter(status=CashSession.Status.OPEN).exists()


class CashMovementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    type_label = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = CashMovement
        fields = ['id', 'type', 'type_label', 'amount', 'reason',
                  'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def get_created_by_name(self, obj) -> str:
        u = obj.created_by
        return (u.full_name or u.username or u.email) if u else ''


class CountLineInput(serializers.Serializer):
    piece = serializers.ChoiceField(choices=['BILL', 'COIN'], default='BILL')
    denomination = serializers.DecimalField(max_digits=8, decimal_places=2)
    quantity = serializers.IntegerField(min_value=0)


class CashSessionSerializer(serializers.ModelSerializer):
    """Fila de historial: lo justo para la tabla."""
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    register_name = serializers.CharField(source='register.name', read_only=True, default='')
    opened_by_name = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CashSession
        fields = [
            'id', 'code', 'status', 'branch', 'branch_name', 'register', 'register_name',
            'opened_by', 'opened_by_name', 'opened_at', 'opening_amount', 'opening_note',
            'closed_by', 'closed_by_name', 'closed_at', 'closing_note',
            'sales_count', 'sales_total', 'cash_sales', 'card_sales', 'transfer_sales',
            'other_sales', 'change_in', 'change_out', 'expenses_cash',
            'cash_in', 'cash_out',
            'expected_amount', 'counted_amount', 'difference',
        ]

    def _name(self, u) -> str:
        return (u.full_name or u.username or u.email) if u else ''

    def get_opened_by_name(self, obj) -> str: return self._name(obj.opened_by)
    def get_closed_by_name(self, obj) -> str: return self._name(obj.closed_by)


class CashSessionDetailSerializer(CashSessionSerializer):
    """Detalle: agrega conteos, movimientos y, si sigue abierta, los totales en
    vivo (los campos congelados aún están en cero)."""
    opening_count = serializers.SerializerMethodField()
    closing_count = serializers.SerializerMethodField()
    movements = CashMovementSerializer(many=True, read_only=True)
    totals = serializers.SerializerMethodField()

    class Meta(CashSessionSerializer.Meta):
        fields = CashSessionSerializer.Meta.fields + [
            'opening_count', 'closing_count', 'movements', 'totals',
        ]

    def get_opening_count(self, obj): return count_breakdown(obj, CountStage.OPENING)
    def get_closing_count(self, obj): return count_breakdown(obj, CountStage.CLOSING)

    def get_totals(self, obj):
        from .services import compute_totals
        if obj.status == CashSession.Status.OPEN:
            return {k: str(v) for k, v in compute_totals(obj).items()}
        return {
            'sales_count': obj.sales_count,
            'sales_total': str(obj.sales_total),
            'cash_sales': str(obj.cash_sales),
            'card_sales': str(obj.card_sales),
            'transfer_sales': str(obj.transfer_sales),
            'other_sales': str(obj.other_sales),
            'change_in': str(obj.change_in),
            'change_out': str(obj.change_out),
            'expenses_cash': str(obj.expenses_cash),
            'cash_in': str(obj.cash_in),
            'cash_out': str(obj.cash_out),
            'total_income': str(obj.sales_total + obj.change_in + obj.cash_in),
            'total_outflow': str(obj.change_out + obj.cash_out + obj.expenses_cash),
            'expected_amount': str(obj.expected_amount),
        }


class OpenSessionSerializer(serializers.Serializer):
    branch = serializers.IntegerField()
    register = serializers.IntegerField(required=False, allow_null=True)
    opening_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0)
    lines = CountLineInput(many=True, required=False)
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)


class CloseSessionSerializer(serializers.Serializer):
    counted_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0)
    lines = CountLineInput(many=True, required=False)
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)


class MovementInputSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=['IN', 'OUT'])
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True)
