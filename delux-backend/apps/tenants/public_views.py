"""Endpoint público para obtener el tenant + branding actual."""
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Tenant


class CurrentTenantView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Por ahora: primer tenant activo. En producción usar middleware por dominio.
        host = request.get_host().split(':')[0].lower()
        # Permitir override con ?slug=
        slug = request.query_params.get('slug')
        if slug:
            tenant = Tenant.objects.filter(slug=slug, is_active=True).first()
        else:
            # Heurística: si subdominio = slug, lo usamos
            parts = host.split('.')
            if len(parts) >= 3:
                tenant = Tenant.objects.filter(slug=parts[0], is_active=True).first()
            else:
                tenant = None
            if not tenant:
                tenant = Tenant.objects.filter(is_active=True).first()
        if not tenant:
            return Response({'detail': 'No tenant configured.'}, status=404)
        return Response({
            'id': tenant.id,
            'name': tenant.name,
            'slug': tenant.slug,
            'primary_color': tenant.primary_color,
            'accent_color': tenant.accent_color,
            'logo_url': tenant.logo_url,
        })
