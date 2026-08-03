from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .me_views import (
    MeProfileView, MeAddressesViewSet, MeOrdersView,
    MeWishlistView, MeWishlistDeleteView, MeOrderInvoiceFileView,
)

router = DefaultRouter()
router.register(r'me/addresses', MeAddressesViewSet, basename='me-addresses')

urlpatterns = [
    path('me/profile/',  MeProfileView.as_view(),  name='me-profile'),
    path('me/orders/',   MeOrdersView.as_view(),   name='me-orders'),
    path('me/orders/<int:order_id>/invoice-file/', MeOrderInvoiceFileView.as_view(), name='me-order-invoice-file'),
    path('me/wishlist/', MeWishlistView.as_view(), name='me-wishlist'),
    path('me/wishlist/<int:product_id>/', MeWishlistDeleteView.as_view(), name='me-wishlist-delete'),
    *router.urls,
]
