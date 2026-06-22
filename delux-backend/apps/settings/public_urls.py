from django.urls import path
from .public_views import ContactCreateView, NewsletterSubscribeView

urlpatterns = [
    path('contact/', ContactCreateView.as_view(), name='public-contact'),
    path('newsletter/', NewsletterSubscribeView.as_view(), name='public-newsletter'),
]
