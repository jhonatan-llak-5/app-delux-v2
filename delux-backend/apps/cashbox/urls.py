from rest_framework.routers import DefaultRouter

from .views import CashRegisterViewSet, CashSessionViewSet

router = DefaultRouter()
router.register('cash-sessions', CashSessionViewSet, basename='cash-sessions')
router.register('cash-registers', CashRegisterViewSet, basename='cash-registers')

urlpatterns = router.urls
