from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import MeReturnsView, AdminReturnViewSet, AdminSaleChangeViewSet

router = DefaultRouter()
router.register(r'admin/returns', AdminReturnViewSet, basename='admin-returns')
router.register(r'admin/sale-changes', AdminSaleChangeViewSet, basename='admin-sale-changes')

urlpatterns = [
    path('me/returns/', MeReturnsView.as_view(), name='me-returns'),
    *router.urls,
]
