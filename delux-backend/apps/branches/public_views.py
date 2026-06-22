"""Endpoint público de sucursales para el landing / shop.

Devuelve las sucursales activas del tenant actual junto con el número de
productos disponibles en cada una (stock > 0). No requiere autenticación.
"""
from django.db.models import Count, Q
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenants.models import Tenant

from .models import Branch
from .serializers import BranchSerializer


def _resolve_tenant(request):
    """Resuelve el tenant igual que tenants.public_views.CurrentTenantView."""
    slug = request.query_params.get('slug') or request.query_params.get('tenant_slug')
    if slug:
        return Tenant.objects.filter(slug=slug, is_active=True).first()

    host = request.get_host().split(':')[0].lower()
    parts = host.split('.')
    if len(parts) >= 3:
        tenant = Tenant.objects.filter(slug=parts[0], is_active=True).first()
        if tenant:
            return tenant
    return Tenant.objects.filter(is_active=True).first()


class PublicBranchesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        tenant = _resolve_tenant(request)
        if not tenant:
            return Response({'count': 0, 'results': []})

        qs = (
            Branch.objects
            .filter(tenant=tenant, is_active=True)
            .annotate(
                products_count=Count(
                    'stocks__variant__product',
                    filter=Q(stocks__quantity__gt=0),
                    distinct=True,
                )
            )
            .order_by('name')
        )

        city = request.query_params.get('city')
        if city:
            qs = qs.filter(city__iexact=city)

        data = BranchSerializer(qs, many=True).data
        return Response({'count': len(data), 'results': data})
