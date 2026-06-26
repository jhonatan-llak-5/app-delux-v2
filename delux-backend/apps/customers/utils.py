"""Utilidades de clientes."""


def link_customer_to_user(customer):
    """Vincula la ficha de cliente (Customer) a una cuenta de usuario (User)
    con el mismo correo, si existe y ninguna otra ficha la ocupa todavia.

    Asi, cuando un usuario registrado compra, su ficha de comprador queda
    asociada a su cuenta y no se duplica como persona distinta.
    """
    if getattr(customer, 'user_id', None):
        return customer
    if not customer.email:
        return customer
    from apps.accounts.models import User
    from .models import Customer
    user = User.objects.filter(email__iexact=customer.email).first()
    if not user:
        return customer
    taken = Customer.objects.filter(user=user).exclude(pk=customer.pk).exists()
    if taken:
        return customer
    customer.user = user
    customer.save(update_fields=['user'])
    return customer
