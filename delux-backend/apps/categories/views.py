from django.db.models import Count, Q
from django.db import transaction
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperadmin
from .models import Category
from .serializers import (
    CategorySerializer,
    CategoryCreateUpdateSerializer,
    CategoryTreeNodeSerializer,
    CategoryReorderSerializer,
)


class AdminCategoryViewSet(viewsets.ModelViewSet):
    """CRUD de categorías para Superadmin."""
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'slug']
    ordering_fields = ['sort_order', 'name', 'created_at']
    ordering = ['sort_order', 'name']

    def get_queryset(self):
        qs = (
            Category.objects
            .select_related('parent', 'tenant')
            .annotate(children_count=Count('children'))
        )
        # Filtros opcionales
        parent_id = self.request.query_params.get('parent')
        if parent_id == 'null':
            qs = qs.filter(parent__isnull=True)
        elif parent_id:
            qs = qs.filter(parent_id=parent_id)
        is_active = self.request.query_params.get('is_active')
        if is_active in ('true', 'false'):
            qs = qs.filter(is_active=(is_active == 'true'))
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CategoryCreateUpdateSerializer
        return CategorySerializer

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Devuelve árbol completo: solo raíces con children anidados."""
        only_active = request.query_params.get('only_active') == 'true'
        qs = Category.objects.filter(parent__isnull=True)
        if only_active:
            qs = qs.filter(is_active=True)
        qs = qs.order_by('sort_order', 'name')
        data = CategoryTreeNodeSerializer(qs, many=True, context={'only_active': only_active}).data
        return Response({'results': data, 'count': len(data)})

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        cat = self.get_object()
        cat.is_active = not cat.is_active
        cat.save(update_fields=['is_active', 'updated_at'])
        return Response({'detail': 'Estado actualizado.', 'is_active': cat.is_active})

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Drag-and-drop: actualiza sort_order y opcionalmente parent."""
        serializer = CategoryReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data['items']
        with transaction.atomic():
            for it in items:
                cat = Category.objects.filter(pk=it['id']).first()
                if not cat:
                    continue
                cat.sort_order = it.get('sort_order', cat.sort_order)
                if 'parent' in it:
                    parent_id = it['parent']
                    cat.parent_id = parent_id if parent_id else None
                cat.save(update_fields=['sort_order', 'parent', 'updated_at'])
        return Response({'detail': 'Orden actualizado.', 'count': len(items)})
