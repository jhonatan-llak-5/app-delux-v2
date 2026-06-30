from django.urls import path
from . import kiosk_views

urlpatterns = [
    path('product/', kiosk_views.kiosk_product),
    path('search/',  kiosk_views.kiosk_search),
    path('qr/',      kiosk_views.kiosk_qr),
    path('featured/', kiosk_views.kiosk_featured),
    path('info/',    kiosk_views.kiosk_info),
    path('unlock/',  kiosk_views.kiosk_unlock),
]
