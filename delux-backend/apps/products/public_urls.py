from django.urls import path
from .public_views import PublicProductsView, SearchAutocompleteView, ProductFacetsView

urlpatterns = [
    path('products/', PublicProductsView.as_view(), name='public-products'),
    path('products/facets/', ProductFacetsView.as_view(), name='product-facets'),
    path('search/autocomplete/', SearchAutocompleteView.as_view(), name='search-autocomplete'),
]
