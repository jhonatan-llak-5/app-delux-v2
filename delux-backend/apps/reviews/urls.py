from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PublicReviewListView, MeReviewCreateView, AdminReviewViewSet

router = DefaultRouter()
router.register(r'admin/reviews', AdminReviewViewSet, basename='admin-reviews')

urlpatterns = [
    path('products/<int:product_id>/reviews/', PublicReviewListView.as_view(), name='product-reviews'),
    path('me/reviews/', MeReviewCreateView.as_view(), name='me-create-review'),
    *router.urls,
]
