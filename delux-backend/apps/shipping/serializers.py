from rest_framework import serializers
from .models import Shipment, ShipmentEvent


class ShipmentEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    actor_name = serializers.CharField(source='actor.full_name', read_only=True, default=None)

    class Meta:
        model = ShipmentEvent
        fields = ('id', 'status', 'status_label', 'description', 'location',
                  'actor_name', 'created_at')


class ShipmentSerializer(serializers.ModelSerializer):
    events = ShipmentEventSerializer(many=True, read_only=True)
    order_code = serializers.CharField(source='order.code', read_only=True)
    carrier_label = serializers.CharField(source='get_carrier_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Shipment
        fields = ('id', 'order', 'order_code', 'tracking_code',
                  'carrier', 'carrier_label', 'status', 'status_label',
                  'estimated_delivery', 'shipping_cost',
                  'recipient_name', 'recipient_phone',
                  'address_line1', 'address_line2', 'city', 'region', 'country',
                  'notes', 'events', 'created_at', 'updated_at')
        read_only_fields = ('id', 'tracking_code', 'created_at', 'updated_at')
