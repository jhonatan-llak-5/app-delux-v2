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
from .realtime import push_courier_moved, push_shipment_event


def gen_tracking() -> str:
    return f'DLX-TR-{timezone.now().strftime("%y%m%d")}-{secrets.token_hex(4).upper()}'


def _branch_geo(branch) -> dict:
    """Devuelve dict con lat/lon/name de la sucursal (origen del envío)."""
    if not branch:
        return {}
    return {
        'name': branch.name,
        'city': branch.city,
        'address': branch.address,
        'latitude':  float(branch.latitude)  if branch.latitude  is not None else None,
        'longitude': float(branch.longitude) if branch.longitude is not None else None,
    }


def _serialize_public(s: Shipment) -> dict:
    """Payload completo para la vista pública (timeline + mapa)."""
    return {
        'tracking_code': s.tracking_code,
        'order_code': s.order.code,
        'status': s.status,
        'status_label': s.get_status_display(),
        'carrier': s.get_carrier_display(),
        'carrier_code': s.carrier,
        'recipient_name': s.recipient_name,
        'city': s.city,
        'address_line1': s.address_line1,
        'estimated_delivery': s.estimated_delivery,
        'origin': _branch_geo(s.order.branch),
        'destination': {
            'address': f'{s.address_line1}, {s.city}',
            'latitude':  float(s.dest_latitude)  if s.dest_latitude  is not None else None,
            'longitude': float(s.dest_longitude) if s.dest_longitude is not None else None,
        },
        'courier': {
            'latitude':  float(s.courier_latitude)  if s.courier_latitude  is not None else None,
            'longitude': float(s.courier_longitude) if s.courier_longitude is not None else None,
            'updated_at': s.courier_updated_at,
        } if s.carrier == 'INHOUSE' else None,
        'events': [{
            'status': e.status,
            'status_label': e.get_status_display(),
            'description': e.description,
            'location': e.location,
            'latitude':  float(e.latitude)  if e.latitude  is not None else None,
            'longitude': float(e.longitude) if e.longitude is not None else None,
            'created_at': e.created_at,
        } for e in s.events.order_by('-created_at')],
    }


class PublicTrackingView(APIView):
    """GET público — devuelve estado + timeline + coordenadas para Leaflet."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, tracking_code):
        s = (
            Shipment.objects
            .select_related('order', 'order__branch')
            .prefetch_related('events')
            .filter(tracking_code__iexact=tracking_code)
            .first()
        )
        if not s:
            return Response({'detail': 'Código no encontrado.'}, status=404)
        return Response(_serialize_public(s))


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
        """Cambia status + registra evento + emails + WS broadcast."""
        s = self.get_object()
        new_status = request.data.get('status')
        desc = request.data.get('description', '')
        location = request.data.get('location', '')
        lat = request.data.get('latitude')
        lon = request.data.get('longitude')

        if new_status not in dict(ShipmentStatus.choices):
            return Response({'detail': 'Estado inválido.'}, status=400)

        with transaction.atomic():
            s.status = new_status
            s.save(update_fields=['status', 'updated_at'])
            event = ShipmentEvent.objects.create(
                tenant=s.tenant, shipment=s,
                status=new_status,
                description=desc or dict(ShipmentStatus.choices)[new_status],
                location=location,
                latitude=lat or None,
                longitude=lon or None,
                actor=request.user if request.user.is_authenticated else None,
            )

            # Sincronizar Order.status
            from apps.orders.models import OrderStatus
            mapping = {
                'PREPARING': OrderStatus.PREPARING,
                'SHIPPED':   OrderStatus.SHIPPED,
                'IN_TRANSIT': OrderStatus.SHIPPED,
                'DELIVERED': OrderStatus.DELIVERED,
            }
            if new_status in mapping:
                s.order.status = mapping[new_status]
                s.order.save(update_fields=['status', 'updated_at'])

        # Broadcast WebSocket (público — el cliente con la página abierta lo ve)
        try:
            push_shipment_event(s, event)
        except Exception as e:
            print(f'[ws push_shipment_event] {e}')

        # Notificar al panel admin (campanita)
        try:
            from apps.notifications.realtime import push_admin_notification
            push_admin_notification(
                type='shipment_updated',
                title=f'Envío {s.tracking_code}',
                message=f'Cambió a "{s.get_status_display()}"',
                link=f'/app/admin/shipments',
                meta={'tracking_code': s.tracking_code, 'status': new_status},
            )
        except Exception as e:
            print(f'[ws admin] {e}')

        # Email al cliente por cada estado relevante
        try:
            from apps.notifications.services import notify_order_state_change
            notify_order_state_change(s.order, new_status, tracking_code=s.tracking_code)
        except Exception as e:
            print(f'[email state] {e}')

        return Response(ShipmentSerializer(s).data)

    @action(detail=True, methods=['post'], url_path='courier-location')
    def courier_location(self, request, pk=None):
        """
        Solo carrier INHOUSE: el repartidor (app PWA) envía su lat/lon cada N segundos.
        Body: { "latitude": -0.18, "longitude": -78.47 }
        """
        s = self.get_object()
        if s.carrier != 'INHOUSE':
            return Response({'detail': 'Solo aplicable a envíos INHOUSE.'}, status=400)
        try:
            lat = float(request.data.get('latitude'))
            lon = float(request.data.get('longitude'))
        except (TypeError, ValueError):
            return Response({'detail': 'latitude/longitude inválidos.'}, status=400)

        s.courier_latitude = lat
        s.courier_longitude = lon
        s.courier_updated_at = timezone.now()
        s.save(update_fields=['courier_latitude', 'courier_longitude',
                              'courier_updated_at', 'updated_at'])

        try:
            push_courier_moved(s, lat, lon)
        except Exception as e:
            print(f'[ws courier_moved] {e}')

        return Response({'ok': True, 'updated_at': s.courier_updated_at})
