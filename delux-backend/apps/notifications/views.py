"""API REST de notificaciones del usuario autenticado.

La campana se HIDRATA con una llamada a `list` + `unread-count` al cargar; luego
todo llega en vivo por WebSocket. Marcar leido / preferencias tambien es REST.
Sin polling.
"""
from django.utils import timezone
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        p = self.request.query_params
        if p.get('unread') == 'true':
            qs = qs.filter(is_read=False)
        if p.get('type'):
            qs = qs.filter(type=p['type'])
        if p.get('priority'):
            qs = qs.filter(priority=p['priority'])
        return qs

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_read(self, request):
        ids = request.data.get('ids')
        qs = Notification.objects.filter(recipient=request.user, is_read=False)
        if ids:
            qs = qs.filter(id__in=ids)
        updated = qs.update(is_read=True, read_at=timezone.now())
        return Response({'updated': updated})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        updated = (Notification.objects
                   .filter(recipient=request.user, is_read=False)
                   .update(is_read=True, read_at=timezone.now()))
        return Response({'updated': updated})

    @action(detail=False, methods=['delete'], url_path='clear')
    def clear(self, request):
        deleted, _ = Notification.objects.filter(recipient=request.user).delete()
        return Response({'deleted': deleted})

    @action(detail=False, methods=['get', 'put'], url_path='preferences')
    def preferences(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        if request.method == 'PUT':
            ser = NotificationPreferenceSerializer(pref, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            return Response(ser.data)
        return Response(NotificationPreferenceSerializer(pref).data)
