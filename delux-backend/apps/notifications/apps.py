from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notifications'
    label = 'notifications'

    def ready(self):
        # Import deferred para registrar signals
        from . import signals  # noqa: F401
