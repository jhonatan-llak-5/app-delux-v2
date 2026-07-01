from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    MyCommissionViewSet, MyPayoutViewSet, MyAffiliateProductsView, AdminAffiliateViewSet,
    AdminCommissionViewSet, AdminPayoutViewSet,
)

router = DefaultRouter()
router.register('commissions', MyCommissionViewSet, basename='my-commission')
router.register('payouts', MyPayoutViewSet, basename='my-payout')
router.register('admin/affiliates', AdminAffiliateViewSet, basename='admin-affiliate')
router.register('admin/commissions', AdminCommissionViewSet, basename='admin-commission')
router.register('admin/payouts', AdminPayoutViewSet, basename='admin-payout')

urlpatterns = router.urls + [
    path('products/', MyAffiliateProductsView.as_view(), name='my-affiliate-products'),
]
