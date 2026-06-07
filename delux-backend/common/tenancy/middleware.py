"""
TenantMiddleware
Resuelve el tenant activo desde:
1) Header HTTP X-Tenant: <slug>.
2) Subdominio (ej: delux.api.example.com -> slug delux).
3) Fallback al DEFAULT_TENANT_SLUG.
Coloca el slug en request.tenant_slug.
"""
from __future__ import annotations
from typing import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse


class TenantMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request.tenant_slug = self._resolve_slug(request)
        request.tenant = None
        return self.get_response(request)

    def _resolve_slug(self, request: HttpRequest) -> str:
        slug = request.META.get(getattr(settings, 'TENANT_HEADER', 'HTTP_X_TENANT'))
        if slug:
            return slug.strip().lower()
        host = request.get_host().split(':')[0]
        parts = host.split('.')
        if len(parts) >= 3:
            return parts[0].lower()
        return getattr(settings, 'DEFAULT_TENANT_SLUG', 'delux')
