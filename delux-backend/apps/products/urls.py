from django.urls import path
from rest_framework.routers import DefaultRouter

from .bulk_views import (
    ProductBulkCommitView,
    ProductBulkDryRunView,
    ProductBulkTemplateView,
)
from .views import AdminProductViewSet

router = DefaultRouter()
router.register(r'', AdminProductViewSet, basename='admin-products')

urlpatterns = [
    # Bulk import: deben ir ANTES del router para evitar capturas de '' como pk
    path('bulk-import/template/', ProductBulkTemplateView.as_view(),
         name='product-bulk-template'),
    path('bulk-import/dry-run/',  ProductBulkDryRunView.as_view(),
         name='product-bulk-dryrun'),
    path('bulk-import/commit/',   ProductBulkCommitView.as_view(),
         name='product-bulk-commit'),
]
urlpatterns += router.urls
