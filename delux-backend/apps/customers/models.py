from django.db import models
from django.db.models import Q, F
from django.db.models.functions import Lower
from common.models import TenantOwnedModel


class Customer(TenantOwnedModel):
    """Cliente final del e-commerce (vinculado opcionalmente a un User)."""
    user = models.OneToOneField(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='customer_profile'
    )
    full_name = models.CharField(max_length=160)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    document_id = models.CharField(max_length=30, blank=True)
    # Códigos SRI (alineados con facturación electrónica)
    DOC_TYPES = [
        ('05', 'Cédula'),
        ('04', 'RUC'),
        ('06', 'Pasaporte'),
        ('07', 'Consumidor final'),
        ('08', 'Identificación del exterior'),
        ('09', 'Placa'),
    ]
    document_type = models.CharField(max_length=2, choices=DOC_TYPES, default='05', blank=True)
    business_name = models.CharField(max_length=160, blank=True)
    address = models.CharField(max_length=240, blank=True)
    province = models.CharField(max_length=80, blank=True)
    accepts_marketing = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        indexes = [models.Index(fields=['tenant', 'email'])]
        constraints = [
            # Un correo = un cliente por tienda (sin distinguir mayusculas).
            # Parcial: no aplica a correos vacios.
            models.UniqueConstraint(
                Lower('email'), F('tenant'),
                condition=~Q(email=''),
                name='uniq_customer_tenant_email',
            ),
        ]

    def __str__(self) -> str:
        return self.full_name


class Address(TenantOwnedModel):
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='addresses'
    )
    label = models.CharField(max_length=40, default='Principal')
    line1 = models.CharField(max_length=200)
    line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=80)
    region = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, default='Ecuador')
    postal_code = models.CharField(max_length=20, blank=True)
    is_default = models.BooleanField(default=False)


class WishlistItem(TenantOwnedModel):
    """Producto favorito del cliente. Persiste en su perfil."""
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='wishlist_items'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='wishlist_items'
    )

    class Meta:
        unique_together = [('customer', 'product')]
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.customer} ❤ {self.product}'
