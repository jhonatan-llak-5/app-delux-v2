from django.db import transaction
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager
from .models import Branch, BranchSchedule
from .schedule_serializers import BranchScheduleSerializer, BulkScheduleSerializer


class BranchScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = BranchScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]

    def get_queryset(self):
        qs = BranchSchedule.objects.select_related('branch')
        user = self.request.user
        if user.role == 'BRANCH_MANAGER':
            qs = qs.filter(branch=user.branch)
        branch = self.request.query_params.get('branch')
        if branch:
            qs = qs.filter(branch_id=branch)
        return qs

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        """Guarda los 7 días de horario para una sucursal."""
        serializer = BulkScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data['schedules']
        if not items:
            return Response({'detail': 'Lista vacia.'}, status=400)

        branch_id = items[0].get('branch')
        branch = Branch.objects.filter(pk=branch_id).first()
        if not branch:
            return Response({'detail': 'Sucursal no encontrada.'}, status=400)

        with transaction.atomic():
            for it in items:
                BranchSchedule.objects.update_or_create(
                    tenant=branch.tenant,
                    branch=branch,
                    weekday=it['weekday'],
                    defaults={
                        'open_time': it.get('open_time') or None,
                        'close_time': it.get('close_time') or None,
                        'is_closed': it.get('is_closed', False),
                    },
                )
        return Response({'detail': 'Horario guardado.', 'count': len(items)})
