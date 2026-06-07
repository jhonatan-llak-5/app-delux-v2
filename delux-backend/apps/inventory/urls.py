from rest_framework.routers import DefaultRouter
from .views import AdminStockViewSet, AdminMovementViewSet

router = DefaultRouter()
router.register(r'stocks',    AdminStockViewSet,    basename='admin-stocks')
router.register(r'movements', AdminMovementViewSet, basename='admin-movements')
urlpatterns = router.urls
