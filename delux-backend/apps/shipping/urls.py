from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PublicTrackingView, AdminShipmentViewSet

router = DefaultRouter()
router.register(r'admin/shipments', AdminShipmentViewSet, basename='admin-shipments')

urlpatterns = [
    path('tracking/<str:tracking_code>/', PublicTrackingView.as_view(), name='public-tracking'),
    *router.urls,
]
