from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'priority', 'title', 'message', 'link',
            'meta', 'is_read', 'created_at', 'read_at',
        ]
        read_only_fields = fields


from .models import NotificationPreference  # noqa: E402


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ['sound_enabled', 'disabled_types', 'dnd_start', 'dnd_end']
