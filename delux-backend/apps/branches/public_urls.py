from django.urls import path

from .public_views import PublicBranchesView

urlpatterns = [
    path('branches/', PublicBranchesView.as_view(), name='public-branches'),
]
