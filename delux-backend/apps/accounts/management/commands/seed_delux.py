"""Seed inicial completo de la plataforma Delux."""
from __future__ import annotations

import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role
from apps.branches.models import Branch
from apps.brands.models import Brand
from apps.categories.models import Category
from apps.inventory.models import Stock
from apps.products.models import Product, ProductImage, ProductStatus, ProductTag
from apps.settings.models import PlatformSettings
from apps.tenants.models import Tenant
from apps.variants.models import Variant

User = get_user_model()

SUPERADMIN_EMAIL = 'admin@gmail.com'
SUPERADMIN_PASSWORD = '12345678'

SHOE_SIZES = ['38', '39', '40', '41', '42', '43']
CLOTHING_SIZES = ['S', 'M', 'L', 'XL']
COLORS = ['Negro', 'Blanco', 'Gris', 'Azul']

BRANDS_DATA = [
    {'name': 'Nike',        'slug': 'nike',        'country': 'Estados Unidos', 'year': 1964,
     'website': 'https://nike.com',
     'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg',
     'description': 'Lider mundial en calzado e indumentaria deportiva.'},
    {'name': 'Adidas',      'slug': 'adidas',      'country': 'Alemania',       'year': 1949,
     'website': 'https://adidas.com',
     'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg',
     'description': 'Marca alemana sinonimo de performance y cultura urbana.'},
    {'name': 'Puma',        'slug': 'puma',        'country': 'Alemania',       'year': 1948,
     'website': 'https://puma.com',
     'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Puma_complete_logo.svg',
     'description': 'Innovacion y velocidad para atletas de elite.'},
    {'name': 'New Balance', 'slug': 'new-balance', 'country': 'Estados Unidos', 'year': 1906,
     'website': 'https://newbalance.com',
     'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/New_Balance_logo.svg',
     'description': 'Heritage americano con calidad artesanal.'},
    {'name': 'Vans',        'slug': 'vans',        'country': 'Estados Unidos', 'year': 1966,
     'website': 'https://vans.com',
     'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/9/91/Vans_logo.svg',
     'description': 'Iconos de la cultura skate desde California.'},
    {'name': 'Converse',    'slug': 'converse',    'country': 'Estados Unidos', 'year': 1908,
     'website': 'https://converse.com',
     'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Converse_logo.svg',
     'description': 'Las Chuck Taylor: las zapatillas mas iconicas.'},
    {'name': 'Jordan',      'slug': 'jordan',      'country': 'Estados Unidos', 'year': 1984,
     'website': 'https://jordan.com',
     'logo_url': 'https://upload.wikimedia.org/wikipedia/en/3/37/Jumpman_logo.svg',
     'description': 'La marca de Michael Jordan. Cultura y basketball.'},
]

IMG_POOLS = {
    'zapatillas': [
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1600185365778-7c4e2bbd8a4f?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1539185441755-769473a23570?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=1200&q=85&auto=format&fit=crop',
    ],
    'ropa': [
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1200&q=85&auto=format&fit=crop',
    ],
    'mochilas': [
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=85&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=1200&q=85&auto=format&fit=crop',
    ],
    'accesorios': [
        'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=1200&q=85&auto=format&fit=crop',
    ],
}


class Command(BaseCommand):
    help = 'Siembra datos iniciales de Delux.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.NOTICE('-> Sembrando datos de Delux...'))
        PlatformSettings.load()

        sa, created = User.objects.get_or_create(
            email=SUPERADMIN_EMAIL,
            defaults={
                'username': SUPERADMIN_EMAIL, 'full_name': 'Super Admin',
                'role': Role.SUPERADMIN, 'is_staff': True, 'is_superuser': True,
                'is_active': True, 'is_email_verified': True,
            },
        )
        sa.set_password(SUPERADMIN_PASSWORD)
        sa.role = Role.SUPERADMIN
        sa.is_staff = True
        sa.is_superuser = True
        sa.is_active = True
        sa.is_email_verified = True
        sa.save()
        self.stdout.write(f'  superadmin -> {SUPERADMIN_EMAIL} / {SUPERADMIN_PASSWORD}')

        tenant, _ = Tenant.objects.get_or_create(
            slug='delux',
            defaults={
                'name': 'Delux', 'legal_id': '1790000000001',
                'primary_color': '#22D3EE', 'accent_color': '#7C3AED',
                'is_active': True,
            },
        )
        self.stdout.write(f' OK Tenant: {tenant.name}')

        tenant_admin, _ = User.objects.get_or_create(
            email='delux@gmail.com',
            defaults={
                'username': 'delux@gmail.com', 'full_name': 'Admin Delux',
                'role': Role.TENANT_ADMIN, 'tenant': tenant,
                'is_active': True, 'is_email_verified': True,
            },
        )
        tenant_admin.set_password('12345678')
        tenant_admin.tenant = tenant
        tenant_admin.role = Role.TENANT_ADMIN
        tenant_admin.is_active = True
        tenant_admin.is_email_verified = True
        tenant_admin.save()

        branch_defs = [
            ('CENTRO', 'Delux Centro', 'Quito', 'Av. Amazonas N24-03 y Colon'),
            ('NORTE',  'Delux Norte',  'Quito', 'C.C. Quicentro Shopping'),
            ('CUENCA', 'Delux Cuenca', 'Cuenca', 'Av. Solano 5-23'),
        ]
        branches = []
        for code, name, city, address in branch_defs:
            b, _ = Branch.objects.get_or_create(
                tenant=tenant, code=code,
                defaults={
                    'name': name, 'city': city, 'address': address,
                    'phone': '+593 2 000 0000',
                    'opening_hours': 'Lun - Sab 10:00 a 20:00',
                    'allows_pickup': True, 'is_active': True,
                },
            )
            branches.append(b)

        brands = {}
        for i, b in enumerate(BRANDS_DATA):
            brand, _ = Brand.objects.update_or_create(
                tenant=tenant, slug=b['slug'],
                defaults={
                    'name': b['name'], 'logo_url': b['logo_url'],
                    'description': b['description'],
                    'country_of_origin': b['country'],
                    'website': b['website'], 'founded_year': b['year'],
                    'is_active': True, 'is_featured': i < 4, 'sort_order': i,
                },
            )
            brands[b['name']] = brand

        cat_defs = [
            ('zapatillas',  'Zapatillas',  'fa-shoe-prints',    None, 1),
            ('ropa',        'Ropa',        'fa-shirt',          None, 2),
            ('mochilas',    'Mochilas',    'fa-bag-shopping',   None, 3),
            ('accesorios',  'Accesorios',  'fa-hat-cowboy',     None, 4),
            ('running',     'Running',     'fa-person-running', 'zapatillas', 1),
            ('lifestyle',   'Lifestyle',   'fa-shoe-prints',    'zapatillas', 2),
            ('skate',       'Skate',       'fa-skating',        'zapatillas', 3),
            ('basket',      'Basket',      'fa-basketball',     'zapatillas', 4),
            ('futbol',      'Futbol',      'fa-futbol',         'zapatillas', 5),
            ('outdoor',     'Outdoor',     'fa-mountain',       'zapatillas', 6),
            ('hoodies',     'Hoodies',     'fa-shirt',          'ropa', 1),
            ('polos',       'Polos',       'fa-shirt',          'ropa', 2),
            ('pantalones',  'Pantalones',  'fa-person',         'ropa', 3),
            ('shorts',      'Shorts',      'fa-person-walking', 'ropa', 4),
            ('camperas',    'Camperas',    'fa-snowflake',      'ropa', 5),
            ('urbana',      'Urbana',      'fa-city',           'mochilas', 1),
            ('deportiva',   'Deportiva',   'fa-dumbbell',       'mochilas', 2),
            ('casual',      'Casual',      'fa-bag-shopping',   'mochilas', 3),
            ('medias',      'Medias',      'fa-socks',          'accesorios', 1),
            ('gorros',      'Gorros',      'fa-hat-cowboy',     'accesorios', 2),
            ('cinturones',  'Cinturones',  'fa-ring',           'accesorios', 3),
            ('llaveros',    'Llaveros',    'fa-key',            'accesorios', 4),
        ]
        cats = {}
        for slug, name, icon, parent_slug, order in cat_defs:
            if parent_slug is None:
                c, _ = Category.objects.update_or_create(
                    tenant=tenant, slug=slug,
                    defaults={'name': name, 'icon': icon,
                              'sort_order': order, 'is_active': True,
                              'parent': None},
                )
                cats[slug] = c
        for slug, name, icon, parent_slug, order in cat_defs:
            if parent_slug is not None:
                c, _ = Category.objects.update_or_create(
                    tenant=tenant, slug=slug,
                    defaults={'name': name, 'icon': icon,
                              'sort_order': order, 'is_active': True,
                              'parent': cats.get(parent_slug)},
                )
                cats[slug] = c

        catalog = [
            ('Ultra Boost Light',  'Adidas',      'zapatillas', 200, ProductTag.DROP),
            ('Campus Classic',     'Adidas',      'zapatillas', 180, ProductTag.NEW),
            ('Samba OG',           'Adidas',      'zapatillas', 160, ProductTag.NEW),
            ('Air Max Plus',       'Nike',        'zapatillas', 220, ProductTag.SALE),
            ('Air Force 1',        'Nike',        'zapatillas', 150, ProductTag.NEW),
            ('Old Skool',          'Vans',        'zapatillas',  85, ProductTag.SALE),
            ('550 White',          'New Balance', 'zapatillas', 130, ProductTag.NEW),
            ('Hoodie Tech Fleece', 'Nike',        'ropa',        95, ProductTag.NEW),
            ('Polo Three Stripes', 'Adidas',      'ropa',        45, ''),
            ('Mochila Tech Pack',  'Puma',        'mochilas',    75, ProductTag.DROP),
            ('Mochila Originals',  'Adidas',      'mochilas',    65, ''),
            ('Gorro Snapback',     'Nike',        'accesorios',  30, ''),
            ('Forum Low',          'Adidas',      'zapatillas', 140, ProductTag.EXCLUSIVE),
            ('Pulse Runner',       'Puma',        'zapatillas', 220, ProductTag.NEW),
            ('Heritage OG',        'Converse',    'zapatillas',  95, ProductTag.NEW),
            ('Court Vintage',      'Nike',        'zapatillas', 180, ProductTag.DROP),
        ]

        for idx, (name, brand_name, cat_slug, price, tag) in enumerate(catalog):
            slug = name.lower().replace(' ', '-')
            pool = IMG_POOLS.get(cat_slug, IMG_POOLS['zapatillas'])
            main_img = pool[idx % len(pool)]
            product, created = Product.objects.update_or_create(
                tenant=tenant, slug=slug,
                defaults={
                    'name': name,
                    'short_description': f'{name} edicion premium en Delux.',
                    'description': f'{name} de {brand_name}. Materiales premium y construccion duradera. Estilo {cat_slug}.',
                    'brand': brands[brand_name],
                    'category': cats[cat_slug],
                    'base_price': price,
                    'compare_at_price': price + 30 if tag == ProductTag.SALE else None,
                    'gender': 'UNISEX',
                    'status': ProductStatus.PUBLISHED,
                    'tag': tag,
                    'is_featured': idx < 6,
                    'main_image_url': main_img,
                },
            )
            product.images.all().delete()
            for k in range(min(4, len(pool))):
                ProductImage.objects.create(
                    product=product,
                    url=pool[(idx + k) % len(pool)],
                    alt=f'{name} vista {k + 1}',
                    sort_order=k,
                    is_main=(k == 0),
                )

            if created:
                sizes = SHOE_SIZES if cat_slug == 'zapatillas' else (
                    CLOTHING_SIZES if cat_slug == 'ropa' else ['UNICA']
                )
                for size in sizes:
                    for color in random.sample(COLORS, k=min(2, len(COLORS))):
                        sku = f'{brand_name[:3].upper()}-{slug[:6].upper()}-{size}-{color[:2].upper()}'
                        v, _ = Variant.objects.get_or_create(
                            tenant=tenant, sku=sku,
                            defaults={'product': product, 'size': size,
                                      'color': color, 'is_active': True},
                        )
                        for branch in branches:
                            Stock.objects.get_or_create(
                                tenant=tenant, variant=v, branch=branch,
                                defaults={'quantity': random.randint(2, 15),
                                          'min_threshold': 2},
                            )

        self.stdout.write(self.style.SUCCESS(
            f' OK {len(catalog)} productos con galeria, variantes y stock'
        ))
        self.stdout.write('Seed completado:')
        self.stdout.write(f'  Productos: {Product.objects.filter(tenant=tenant).count()}')
        self.stdout.write(f'  Imagenes:  {ProductImage.objects.filter(product__tenant=tenant).count()}')
        self.stdout.write(f'  Variantes: {Variant.objects.filter(tenant=tenant).count()}')
