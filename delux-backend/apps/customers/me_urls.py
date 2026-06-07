from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .me_views import (
    MeProfileView, MeAddressesViewSet, MeOrdersView,
    MeWishlistView, MeWishlistDeleteView,
)

router = DefaultRouter()
router.register(r'me/addresses', MeAddressesViewSet, basename='me-addresses')

urlpatterns = [
    path('me/profile/',  MeProfileView.as_view(),  name='me-profile'),
    path('me/orders/',   MeOrdersView.as_view(),   name='me-orders'),
    path('me/wishlist/', MeWishlistView.as_view(), name='me-wishlist'),
    path('me/wishlist/<int:product_id>/', MeWishlistDeleteView.as_view(), name='me-wishlist-delete'),
    *router.urls,
]
