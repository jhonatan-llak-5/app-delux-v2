from django.urls import path

from .views import PlatformSettingsView, TestEmailView, TestPayPhoneView


urlpatterns = [
    path('',                PlatformSettingsView.as_view(), name='admin-settings'),
    path('test-email/',     TestEmailView.as_view(),        name='admin-settings-test-email'),
    path('test-payphone/',  TestPayPhoneView.as_view(),     name='admin-settings-test-payphone'),
]
