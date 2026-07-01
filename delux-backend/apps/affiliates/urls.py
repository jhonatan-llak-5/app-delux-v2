from rest_framework.routers import DefaultRouter
from .views import (
    MyCommissionViewSet, AdminAffiliateViewSet,
    AdminCommissionViewSet, AdminPayoutViewSet,
)

router = DefaultRouter()
router.register('commissions', MyCommissionViewSet, basename='my-commission')
router.register('admin/affiliates', AdminAffiliateViewSet, basename='admin-affiliate')
router.register('admin/commissions', AdminCommissionViewSet, basename='admin-commission')
router.register('admin/payouts', AdminPayoutViewSet, basename='admin-payout')

urlpatterns = router.urls
