from django.urls import path
from .public_views import CurrentTenantView

urlpatterns = [
    path('tenant/current/', CurrentTenantView.as_view(), name='current-tenant'),
]
