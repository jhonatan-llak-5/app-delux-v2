from rest_framework.routers import DefaultRouter
from .views import AdminVariantViewSet

router = DefaultRouter()
router.register(r'variants', AdminVariantViewSet, basename='admin-variants')
urlpatterns = router.urls
