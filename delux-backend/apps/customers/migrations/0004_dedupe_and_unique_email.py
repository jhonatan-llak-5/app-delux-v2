"""Fusiona clientes duplicados por (tenant, email) y agrega la restriccion
"un correo = un cliente por tienda" (parcial, sin distinguir mayusculas)."""
from django.db import migrations, models
from django.db.models import Count, Q, F
from django.db.models.functions import Lower


def merge_duplicates(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    Address = apps.get_model('customers', 'Address')
    Wishlist = apps.get_model('customers', 'WishlistItem')
    Cart = apps.get_model('carts', 'Cart')
    Order = apps.get_model('orders', 'Order')
    Review = apps.get_model('reviews', 'Review')
    ReturnRequest = apps.get_model('returns', 'ReturnRequest')

    groups = (Customer.objects.exclude(email='')
              .annotate(le=Lower('email'))
              .values('tenant_id', 'le')
              .annotate(n=Count('id')).filter(n__gt=1))

    for g in groups:
        dupes = list(Customer.objects.filter(tenant_id=g['tenant_id'])
                     .annotate(le=Lower('email')).filter(le=g['le']))
        # Conserva la mas util: primero la que ya tiene cuenta (user), luego la mas antigua.
        dupes.sort(key=lambda c: (c.user_id is None, c.id))
        keeper, others = dupes[0], dupes[1:]

        keeper_wl = set(Wishlist.objects.filter(customer=keeper).values_list('product_id', flat=True))
        keeper_rv = set(Review.objects.filter(customer=keeper).values_list('product_id', flat=True))

        for o in others:
            # Wishlist: evita choque unique (customer, product)
            for wi in Wishlist.objects.filter(customer=o):
                if wi.product_id in keeper_wl:
                    wi.delete()
                else:
                    wi.customer = keeper; wi.save(); keeper_wl.add(wi.product_id)
            # Review: evita choque unique (product, customer)
            for rv in Review.objects.filter(customer=o):
                if rv.product_id in keeper_rv:
                    rv.delete()
                else:
                    rv.customer = keeper; rv.save(); keeper_rv.add(rv.product_id)
            # El resto se reasigna directo
            Address.objects.filter(customer=o).update(customer=keeper)
            Cart.objects.filter(customer=o).update(customer=keeper)
            Order.objects.filter(customer=o).update(customer=keeper)
            ReturnRequest.objects.filter(customer=o).update(customer=keeper)
            o.delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0003_link_customers_to_users'),
        ('orders', '0003_order_affiliate'),
        ('reviews', '0002_rename_reviews_re_product_idx_reviews_rev_product_0aaa55_idx_and_more'),
        ('returns', '0002_alter_returnitem_id_alter_returnrequest_id'),
        ('carts', '0001_initial'),
    ]

    operations = [
        # Solo fusiona duplicados; la restriccion la agrega la migracion siguiente
        # (generada desde el modelo, para que coincida exactamente).
        migrations.RunPython(merge_duplicates, noop),
    ]
