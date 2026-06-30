from rest_framework import serializers

from .models import Branch, BranchSchedule


_DAYS_SHORT = {0: 'Lun', 1: 'Mar', 2: 'Mie', 3: 'Jue', 4: 'Vie', 5: 'Sab', 6: 'Dom'}


class BranchSerializer(serializers.ModelSerializer):
    tenant_id = serializers.IntegerField(source='tenant.id', read_only=True)
    tenant_slug = serializers.SlugField(source='tenant.slug', read_only=True)
    products_count = serializers.IntegerField(read_only=True, default=0)
    manager_name = serializers.CharField(source='manager.full_name',
                                         read_only=True, default=None)
    kiosk_pin = serializers.CharField(max_length=8, required=False, allow_blank=True)
    schedules = serializers.SerializerMethodField()

    class Meta:
        model = Branch
        fields = (
            'id', 'tenant_id', 'tenant_slug',
            'code', 'name', 'city', 'address',
            'latitude', 'longitude', 'phone', 'email',
            'opening_hours', 'manager', 'manager_name',
            'allows_pickup', 'is_active', 'created_at',
            'products_count',
            'kiosk_token', 'kiosk_pin',
            'schedules',
        )
        read_only_fields = ('kiosk_token',)

    def get_schedules(self, obj):
        return [{
            'weekday': s.weekday,
            'open_time': s.open_time.strftime('%H:%M') if s.open_time else None,
            'close_time': s.close_time.strftime('%H:%M') if s.close_time else None,
            'is_closed': s.is_closed,
        } for s in obj.schedules.all()]

    def _save_schedules(self, branch, schedules):
        branch.schedules.all().delete()
        parts = []
        for sc in schedules:
            try:
                wd = int(sc.get('weekday'))
            except (TypeError, ValueError):
                continue
            closed = bool(sc.get('is_closed'))
            ot = (sc.get('open_time') or None) if not closed else None
            ct = (sc.get('close_time') or None) if not closed else None
            BranchSchedule.objects.create(
                tenant=branch.tenant, branch=branch, weekday=wd,
                open_time=ot, close_time=ct, is_closed=closed,
            )
            if not closed and ot and ct:
                parts.append(_DAYS_SHORT.get(wd, '') + ' ' + ot[:5] + '-' + ct[:5])
        if parts:
            branch.opening_hours = '; '.join(parts)
            branch.save(update_fields=['opening_hours'])

    def create(self, validated_data):
        schedules = self.initial_data.get('schedules')
        branch = super().create(validated_data)
        if isinstance(schedules, list) and schedules:
            self._save_schedules(branch, schedules)
        return branch

    def update(self, instance, validated_data):
        schedules = self.initial_data.get('schedules')
        branch = super().update(instance, validated_data)
        if isinstance(schedules, list):
            self._save_schedules(branch, schedules)
        return branch
