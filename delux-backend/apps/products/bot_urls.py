from django.urls import path
from .bot_views import BotProductsView, BotLeadView

urlpatterns = [
    path('products/', BotProductsView.as_view(), name='bot-products'),
    path('leads/', BotLeadView.as_view(), name='bot-leads'),
]
