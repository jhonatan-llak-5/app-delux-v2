from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import AdminPaymentViewSet, CheckoutPayPhoneInitView, PayPhoneConfirmView

router = DefaultRouter()
router.register(r'payments', AdminPaymentViewSet, basename='admin-payments')

urlpatterns = [
    *router.urls,
    path('checkout/payphone/init/',    CheckoutPayPhoneInitView.as_view(), name='payphone-init'),
    path('checkout/payphone/confirm/', PayPhoneConfirmView.as_view(),      name='payphone-confirm'),
]
