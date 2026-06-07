from rest_framework.routers import DefaultRouter
from .views import AdminCustomerViewSet

router = DefaultRouter()
router.register(r'customers', AdminCustomerViewSet, basename='admin-customers')
urlpatterns = router.urls
