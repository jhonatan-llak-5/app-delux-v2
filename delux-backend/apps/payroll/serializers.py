from rest_framework import serializers
from .models import PayrollRun, PayrollItem


class PayrollItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollItem
        fields = ('id', 'employee', 'employee_name', 'role', 'base_salary',
                  'adjustment', 'amount', 'status', 'method', 'paid_at', 'notes')


class PayrollRunSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True, default='')
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True, default='')
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    paid_count = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = ('id', 'year', 'month', 'branch', 'branch_name', 'status',
                  'total_amount', 'items_count', 'paid_count',
                  'generated_by_name', 'created_at')

    def get_paid_count(self, obj):
        return obj.items.filter(status='PAID').count()


class PayrollRunDetailSerializer(PayrollRunSerializer):
    items = PayrollItemSerializer(many=True, read_only=True)

    class Meta(PayrollRunSerializer.Meta):
        fields = PayrollRunSerializer.Meta.fields + ('items',)


class PayrollGenerateSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2020, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)
    branch = serializers.IntegerField(required=False, allow_null=True)
