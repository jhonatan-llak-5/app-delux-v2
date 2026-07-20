from django.urls import path
from .bot_views import BotProductsView, BotLeadView, BotPausedView, BotResumeView

urlpatterns = [
    path('products/', BotProductsView.as_view(), name='bot-products'),
    path('leads/', BotLeadView.as_view(), name='bot-leads'),
    path('paused/', BotPausedView.as_view(), name='bot-paused'),
    path('resume/', BotResumeView.as_view(), name='bot-resume'),
]
