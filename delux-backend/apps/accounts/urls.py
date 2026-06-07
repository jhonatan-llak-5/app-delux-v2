from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ActivateView,
    ForgotPasswordView,
    LoginView,
    MeView,
    RegisterView,
    ResendCodeView,
    ResetPasswordView,
)


urlpatterns = [
    path('login/',           LoginView.as_view(),          name='auth-login'),
    path('register/',        RegisterView.as_view(),       name='auth-register'),
    path('activate/',        ActivateView.as_view(),       name='auth-activate'),
    path('resend-code/',     ResendCodeView.as_view(),     name='auth-resend'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot'),
    path('reset-password/',  ResetPasswordView.as_view(),  name='auth-reset'),
    path('refresh/',         TokenRefreshView.as_view(),   name='auth-refresh'),
    path('me/',              MeView.as_view(),             name='auth-me'),
]
