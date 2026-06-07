from decimal import Decimal
from django.utils import timezone
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsBranchManager
from .models import Coupon
from .serializers import CouponSerializer, CouponCreateSerializer, CouponValidateSerializer


class AdminCouponViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code']
    ordering_fields = ['code', 'created_at', 'times_used']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Coupon.objects.all()
        params = self.request.query_params
        if params.get('is_active') in ('true', 'false'):
            qs = qs.filter(is_active=(params['is_active'] == 'true'))
        if params.get('type'):
            qs = qs.filter(type=params['type'])
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CouponCreateSerializer
        return CouponSerializer

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        c = self.get_object()
        c.is_active = not c.is_active
        c.save(update_fields=['is_active'])
        return Response({'is_active': c.is_active})

    @action(detail=False, methods=['post'])
    def validate(self, request):
        """Valida un código de cupón y retorna el descuento aplicable."""
        s = CouponValidateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        code = s.validated_data['code'].upper().strip()
        subtotal = s.validated_data['subtotal']

        coupon = Coupon.objects.filter(code__iexact=code).first()
        if not coupon:
            return Response({'detail': 'Cupón no encontrado.', 'valid': False}, status=404)

        now = timezone.now()
        if not coupon.is_active:
            return Response({'detail': 'Cupón inactivo.', 'valid': False}, status=400)
        if coupon.starts_at and coupon.starts_at > now:
            return Response({'detail': 'Cupón aún no es válido.', 'valid': False}, status=400)
        if coupon.ends_at and coupon.ends_at < now:
            return Response({'detail': 'Cupón expirado.', 'valid': False}, status=400)
        if coupon.usage_limit and coupon.times_used >= coupon.usage_limit:
            return Response({'detail': 'Cupón ya alcanzó el límite de usos.', 'valid': False}, status=400)
        if subtotal < coupon.min_purchase:
            return Response({
                'detail': f'Compra mínima ${coupon.min_purchase}.',
                'valid': False,
            }, status=400)

        # Calcular descuento
        if coupon.type == Coupon.TYPE_PERCENT:
            discount = subtotal * coupon.value / Decimal('100')
        else:
            discount = coupon.value

        discount = min(discount, subtotal).quantize(Decimal('0.01'))

        return Response({
            'valid': True,
            'code': coupon.code,
            'type': coupon.type,
            'value': str(coupon.value),
            'discount': str(discount),
            'final_total': str((subtotal - discount).quantize(Decimal('0.01'))),
        })
