from django.urls import path

from .views import PlatformSettingsView, TestEmailView, TestPayPhoneView, PublicUploadConfigView


urlpatterns = [
    path('',                PlatformSettingsView.as_view(), name='admin-settings'),
    path('public-config/',  PublicUploadConfigView.as_view(), name='admin-settings-public-config'),
    path('test-email/',     TestEmailView.as_view(),        name='admin-settings-test-email'),
    path('test-payphone/',  TestPayPhoneView.as_view(),     name='admin-settings-test-payphone'),
]
