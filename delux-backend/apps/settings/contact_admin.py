"""Gestión admin de los mensajes del formulario de contacto."""
from rest_framework import viewsets, permissions, serializers, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsTenantAdmin
from .models import ContactMessage


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ('id', 'name', 'email', 'phone', 'subject', 'message', 'is_read', 'created_at')
        read_only_fields = ('id', 'created_at')


class ContactMessageViewSet(viewsets.ModelViewSet):
    """Bandeja de mensajes de contacto (superadmin / admin de tienda)."""
    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdmin]
    queryset = ContactMessage.objects.all()
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone', 'subject', 'message']
    ordering = ['-created_at']
    http_method_names = ['get', 'delete', 'post', 'patch']

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        m = self.get_object()
        m.is_read = True
        m.save(update_fields=['is_read'])
        return Response(self.get_serializer(m).data)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        return Response({'count': ContactMessage.objects.filter(is_read=False).count()})
