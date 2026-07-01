from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView, SpectacularSwaggerView,
)


api_v1_patterns = [
    path('auth/',       include('apps.accounts.urls')),
    path('categories/', include('apps.categories.urls')),
    path('inventory/',  include('apps.inventory.urls')),
    path('kiosk/',      include('apps.inventory.kiosk_urls')),
    path('customers/',  include('apps.customers.urls')),
    path('',            include('apps.customers.me_urls')),
    path('',            include('apps.reviews.urls')),
    path('',            include('apps.returns.urls')),
    path('',            include('apps.shipping.urls')),
    path('',            include('apps.products.public_urls')),
    path('',            include('apps.tenants.public_urls')),
    path('',            include('apps.branches.public_urls')),
    path('',            include('apps.settings.public_urls')),
    path('carts/',      include('apps.carts.urls')),
    path('orders/',     include('apps.orders.urls')),
    path('affiliate/',  include('apps.affiliates.urls')),
    path('payments/',   include('apps.payments.urls')),
    path('coupons/',    include('apps.coupons.urls')),
    path('admin/',      include('apps.superadmin.urls')),
]


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include((api_v1_patterns, 'api_v1'))),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/',   SpectacularSwaggerView.as_view(url_name='schema'),
                       name='swagger'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
