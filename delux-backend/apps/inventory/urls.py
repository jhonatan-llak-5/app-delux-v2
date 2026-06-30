from rest_framework.routers import DefaultRouter
from .views import (
    AdminStockViewSet, AdminMovementViewSet,
    AdminSupplierViewSet, AdminReceptionViewSet,
)

router = DefaultRouter()
router.register(r'stocks',     AdminStockViewSet,     basename='admin-stocks')
router.register(r'movements',  AdminMovementViewSet,  basename='admin-movements')
router.register(r'suppliers',  AdminSupplierViewSet,  basename='admin-suppliers')
router.register(r'receptions', AdminReceptionViewSet, basename='admin-receptions')
urlpatterns = router.urls
