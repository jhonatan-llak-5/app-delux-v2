from rest_framework.routers import DefaultRouter
from .views import AdminOrderViewSet

router = DefaultRouter()
router.register(r'orders', AdminOrderViewSet, basename='admin-orders')
urlpatterns = router.urls
