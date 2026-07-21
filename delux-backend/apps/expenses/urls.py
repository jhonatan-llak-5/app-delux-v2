from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet
from .finance_views import FinanceViewSet

router = DefaultRouter()
router.register('expenses', ExpenseViewSet, basename='expenses')
router.register('finance', FinanceViewSet, basename='finance')

urlpatterns = router.urls
