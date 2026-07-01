from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PlatformSettingsView, TestEmailView, TestPayPhoneView,
    PublicUploadConfigView, NewsletterSubscriberViewSet,
)

router = DefaultRouter()
router.register('subscribers', NewsletterSubscriberViewSet, basename='newsletter-subscriber')

urlpatterns = [
    path('',                PlatformSettingsView.as_view(), name='admin-settings'),
    path('public-config/',  PublicUploadConfigView.as_view(), name='admin-settings-public-config'),
    path('test-email/',     TestEmailView.as_view(),        name='admin-settings-test-email'),
    path('test-payphone/',  TestPayPhoneView.as_view(),     name='admin-settings-test-payphone'),
    path('', include(router.urls)),
]
