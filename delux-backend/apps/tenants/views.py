from django.db.models import Count
from rest_framework import permissions, viewsets

from apps.accounts.permissions import IsSuperadmin

from .models import Tenant
from .serializers import TenantSerializer


class AdminTenantViewSet(viewsets.ModelViewSet):
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    lookup_field = 'slug'

    def get_queryset(self):
        return (
            Tenant.objects
            .annotate(
                branches_count=Count('branch', distinct=True),
                users_count=Count('users', distinct=True),
            )
            .order_by('name')
        )
