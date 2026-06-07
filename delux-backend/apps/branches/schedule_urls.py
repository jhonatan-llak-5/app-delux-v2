from rest_framework.routers import DefaultRouter
from .schedule_views import BranchScheduleViewSet

router = DefaultRouter()
router.register(r'schedules', BranchScheduleViewSet, basename='admin-schedules')
urlpatterns = router.urls
