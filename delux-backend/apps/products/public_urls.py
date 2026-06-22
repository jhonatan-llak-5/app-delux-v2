from django.urls import path
from .public_views import PublicProductsView, SearchAutocompleteView, ProductFacetsView, PublicProductDetailView

urlpatterns = [
    path('products/', PublicProductsView.as_view(), name='public-products'),
    path('products/<int:pk>/', PublicProductDetailView.as_view(), name='public-product-detail'),
    path('products/facets/', ProductFacetsView.as_view(), name='product-facets'),
    path('search/autocomplete/', SearchAutocompleteView.as_view(), name='search-autocomplete'),
]
