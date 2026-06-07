from rest_framework import serializers
from .models import BranchSchedule


class BranchScheduleSerializer(serializers.ModelSerializer):
    weekday_label = serializers.CharField(source='get_weekday_display', read_only=True)

    class Meta:
        model = BranchSchedule
        fields = ('id', 'branch', 'weekday', 'weekday_label',
                  'open_time', 'close_time', 'is_closed')
        read_only_fields = ('id',)


class BulkScheduleSerializer(serializers.Serializer):
    """Para guardar el horario completo de una semana de una vez."""
    schedules = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
    )
