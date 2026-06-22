from django.db.models import Avg, Count
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsBranchManager
from apps.customers.me_views import get_or_create_customer_for_user
from apps.orders.models import Order, OrderStatus
from .models import Review, ReviewStatus
from .serializers import ReviewSerializer


class PublicReviewListView(APIView):
    """Reviews públicas aprobadas de un producto."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        qs = Review.objects.filter(product_id=product_id, status=ReviewStatus.APPROVED)
        agg = qs.aggregate(avg=Avg('rating'), total=Count('id'))
        distribution = {}
        for r in range(1, 6):
            distribution[str(r)] = qs.filter(rating=r).count()
        return Response({
            'average': round(agg['avg'] or 0, 1),
            'total': agg['total'] or 0,
            'distribution': distribution,
            'results': ReviewSerializer(qs[:50], many=True).data,
        })


class MeReviewCreateView(APIView):
    """Cliente publica una reseña."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        customer = get_or_create_customer_for_user(request.user)
        product_id = request.data.get('product')
        rating = int(request.data.get('rating', 0))
        if not (1 <= rating <= 5):
            return Response({'detail': 'Rating debe ser 1-5.'}, status=400)
        if not product_id:
            return Response({'detail': 'product requerido.'}, status=400)

        verified = Order.objects.filter(
            customer=customer, status=OrderStatus.PAID,
            items__variant__product_id=product_id,
        ).exists()

        review, created = Review.objects.update_or_create(
            tenant=customer.tenant, product_id=product_id, customer=customer,
            defaults={
                'rating': rating,
                'title': request.data.get('title', '')[:120],
                'comment': request.data.get('comment', ''),
                'verified_purchase': verified,
                'status': ReviewStatus.PENDING,
            },
        )
        return Response(ReviewSerializer(review).data, status=201 if created else 200)


class AdminReviewViewSet(viewsets.ModelViewSet):
    """Moderación de reseñas."""
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'customer__full_name', 'comment']
    ordering_fields = ['rating', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Review.objects.select_related('product', 'customer')
        status_p = self.request.query_params.get('status')
        if status_p: qs = qs.filter(status=status_p)
        rating_p = self.request.query_params.get('rating')
        if rating_p: qs = qs.filter(rating=rating_p)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        r = self.get_object(); r.status = ReviewStatus.APPROVED
        r.save(update_fields=['status']); return Response({'status': r.status})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        r = self.get_object(); r.status = ReviewStatus.REJECTED
        r.save(update_fields=['status']); return Response({'status': r.status})
