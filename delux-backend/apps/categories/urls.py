from rest_framework.routers import DefaultRouter
from .views import AdminCategoryViewSet

router = DefaultRouter()
router.register('categories', AdminCategoryViewSet, basename='admin-category')
urlpatterns = router.urls
