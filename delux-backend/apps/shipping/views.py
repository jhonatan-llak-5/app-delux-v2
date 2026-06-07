import secrets
from django.db import transaction
from django.utils import timezone
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsBranchManager
from .models import Shipment, ShipmentEvent, ShipmentStatus
from .serializers import ShipmentSerializer


def gen_tracking() -> str:
    return f'DLX-TR-{timezone.now().strftime("%y%m%d")}-{secrets.token_hex(4).upper()}'


class PublicTrackingView(APIView):
    """Búsqueda pública por código de tracking."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, tracking_code):
        s = Shipment.objects.filter(tracking_code__iexact=tracking_code).first()
        if not s:
            return Response({'detail': 'Código no encontrado.'}, status=404)
        return Response({
            'tracking_code': s.tracking_code,
            'order_code': s.order.code,
            'status': s.status,
            'status_label': s.get_status_display(),
            'carrier': s.get_carrier_display(),
            'recipient_name': s.recipient_name,
            'city': s.city,
            'estimated_delivery': s.estimated_delivery,
            'events': [{
                'status': e.status, 'status_label': e.get_status_display(),
                'description': e.description, 'location': e.location,
                'created_at': e.created_at,
            } for e in s.events.order_by('-created_at')],
        })


class AdminShipmentViewSet(viewsets.ModelViewSet):
    serializer_class = ShipmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tracking_code', 'order__code', 'recipient_name']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Shipment.objects.select_related('order').prefetch_related('events')
        s = self.request.query_params.get('status')
        if s: qs = qs.filter(status=s)
        carrier = self.request.query_params.get('carrier')
        if carrier: qs = qs.filter(carrier=carrier)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            tracking_code=gen_tracking(),
        )

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Cambia status y registra evento."""
        s = self.get_object()
        new_status = request.data.get('status')
        desc = request.data.get('description', '')
        location = request.data.get('location', '')
        if new_status not in dict(ShipmentStatus.choices):
            return Response({'detail': 'Estado inválido.'}, status=400)
        with transaction.atomic():
            s.status = new_status
            s.save(update_fields=['status', 'updated_at'])
            ShipmentEvent.objects.create(
                tenant=s.tenant, shipment=s,
                status=new_status,
                description=desc or dict(ShipmentStatus.choices)[new_status],
                location=location,
                actor=request.user if request.user.is_authenticated else None,
            )
            # Sincronizar Order status
            from apps.orders.models import Order, OrderStatus
            mapping = {
                'SHIPPED': OrderStatus.SHIPPED,
                'IN_TRANSIT': OrderStatus.SHIPPED,
                'DELIVERED': OrderStatus.DELIVERED,
            }
            if new_status in mapping:
                s.order.status = mapping[new_status]
                s.order.save(update_fields=['status', 'updated_at'])
                # Notificar SHIPPED
                if new_status == 'SHIPPED':
                    try:
                        from apps.notifications.services import notify_order_shipped
                        notify_order_shipped(s.order, tracking_code=s.tracking_code)
                    except Exception as e:
                        print(f'[notify_shipped] {e}')
        return Response(ShipmentSerializer(s).data)
