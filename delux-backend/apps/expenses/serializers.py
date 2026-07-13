from rest_framework import serializers
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True, default=None)
    category_label = serializers.CharField(source='get_category_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')

    class Meta:
        model = Expense
        fields = [
            'id', 'date', 'amount', 'category', 'category_label',
            'description', 'branch', 'branch_name', 'receipt_url',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def validate_amount(self, v):
        if v is None or v <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a 0.')
        return v
