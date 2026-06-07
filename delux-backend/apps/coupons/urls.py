from rest_framework.routers import DefaultRouter
from .views import AdminCouponViewSet

router = DefaultRouter()
router.register(r'coupons', AdminCouponViewSet, basename='admin-coupons')
urlpatterns = router.urls
