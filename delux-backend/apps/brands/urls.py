from rest_framework.routers import DefaultRouter

from .views import AdminBrandViewSet


router = DefaultRouter()
router.register(r'', AdminBrandViewSet, basename='admin-brands')

urlpatterns = router.urls
