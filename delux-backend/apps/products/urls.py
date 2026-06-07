from rest_framework.routers import DefaultRouter
from .views import AdminProductViewSet

router = DefaultRouter()
router.register(r'', AdminProductViewSet, basename='admin-products')
urlpatterns = router.urls
