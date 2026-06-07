from django.db import models
from common.models import TenantOwnedModel


class ReviewStatus(models.TextChoices):
    PENDING  = 'PENDING',  'Pendiente'
    APPROVED = 'APPROVED', 'Aprobada'
    REJECTED = 'REJECTED', 'Rechazada'


class Review(TenantOwnedModel):
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='reviews'
    )
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.CASCADE, related_name='reviews'
    )
    rating = models.PositiveSmallIntegerField()  # 1-5
    title = models.CharField(max_length=120, blank=True)
    comment = models.TextField(blank=True)
    verified_purchase = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=ReviewStatus.choices,
                              default=ReviewStatus.PENDING)
    helpful_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('product', 'customer')]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product', 'status']),
            models.Index(fields=['rating']),
        ]

    def __str__(self) -> str:
        return f'{self.rating}★ - {self.product.name}'
