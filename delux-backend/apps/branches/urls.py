from rest_framework.routers import DefaultRouter

from .views import AdminBranchViewSet


router = DefaultRouter()
router.register(r'', AdminBranchViewSet, basename='admin-branches')

urlpatterns = router.urls
