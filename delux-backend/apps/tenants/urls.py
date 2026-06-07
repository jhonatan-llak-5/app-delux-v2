from rest_framework.routers import DefaultRouter

from .views import AdminTenantViewSet


router = DefaultRouter()
router.register(r'', AdminTenantViewSet, basename='admin-tenants')

urlpatterns = router.urls
