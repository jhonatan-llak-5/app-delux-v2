from rest_framework.routers import DefaultRouter
from .views import ReportsViewSet

router = DefaultRouter()
router.register(r'reports', ReportsViewSet, basename='admin-reports')
urlpatterns = router.urls
