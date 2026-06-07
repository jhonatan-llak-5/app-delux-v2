"""URLs agrupadas del panel de superadmin: /api/v1/admin/..."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import AdminUserViewSet


admin_router = DefaultRouter()
admin_router.register(r'users', AdminUserViewSet, basename='admin-users')


urlpatterns = [
    path('',           include(admin_router.urls)),
    path('tenants/',   include('apps.tenants.urls')),
    path('branches/',  include('apps.branches.urls')),
    path('brands/',    include('apps.brands.urls')),
    path('',           include('apps.categories.urls')),
    path('products/',  include('apps.products.urls')),
    path('',           include('apps.variants.urls')),
    path('inventory/', include('apps.inventory.urls')),
    path('',           include('apps.orders.urls')),
    path('',           include('apps.accounts.staff_urls')),
    path('',           include('apps.branches.schedule_urls')),
    path('',           include('apps.customers.urls')),
    path('',           include('apps.coupons.urls')),
    path('',           include('apps.payments.urls')),
    path('',           include('apps.reports.urls')),
    path('settings/',  include('apps.settings.urls')),
]
