from rest_framework.routers import DefaultRouter
from .staff_views import StaffViewSet

router = DefaultRouter()
router.register(r'staff', StaffViewSet, basename='admin-staff')
urlpatterns = router.urls
