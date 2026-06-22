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

        # code, name, city, address, lat, lng, phone, hours
        branch_defs = [
            ('CENTRO', 'Delux Centro', 'Quito', 'Av. Amazonas N24-03 y Colon',
             -0.204600, -78.491800, '+593 2 256 7890', 'Lun - Sab 10:00 a 20:00'),
            ('NORTE',  'Delux Norte',  'Quito', 'C.C. Quicentro Shopping, Local 2-14',
             -0.175900, -78.480100, '+593 2 290 4455', 'Lun - Dom 10:00 a 21:00'),
            ('GYE',    'Delux Mall del Sol', 'Guayaquil', 'C.C. Mall del Sol, Local 128',
             -2.150500, -79.889400, '+593 4 208 3344', 'Lun - Dom 10:00 a 22:00'),
            ('CUENCA', 'Delux Cuenca', 'Cuenca', 'Av. Solano 5-23 y Remigio Crespo',
             -2.903500, -79.008600, '+593 7 280 1122', 'Lun - Sab 10:00 a 19:00'),
        ]
        branches = []
        for code, name, city, address, lat, lng, phone, hours in branch_defs:
            b, _ = Branch.objects.get_or_create(
                tenant=tenant, code=code,
                defaults={
                    'name': name, 'city': city, 'address': address,
                    'latitude': lat, 'longitude': lng,
                    'phone': phone, 'email': f'{code.lower()}@delux.ec',
                    'opening_hours': hours,
                    'allows_pickup': True, 'is_active': True,
                },
            )
            updated = False
            if b.latitude is None or b.longitude is None:
                b.latitude, b.longitude = lat, lng
                updated = True
            if not b.phone or b.phone == '+593 2 000 0000':
                b.phone = phone
                updated = True
            if not b.opening_hours:
                b.opening_hours = hours
                updated = True
            if updated:
                b.save(update_fields=['latitude', 'longitude', 'phone', 'opening_hours'])
            branches.append(b)

        # Un admin (Gerente) por cada sucursal.
        for b in branches:
            email = f'admin.{b.code.lower()}@delux.ec'
            mgr, _ = User.objects.get_or_create(
                email=email,
                defaults={'username': f'admin_{b.code.lower()}'},
            )
            mgr.set_password('12345678')
            mgr.full_name = f'Admin {b.name}'
            mgr.role = Role.BRANCH_MANAGER
            mgr.tenant = tenant
            mgr.branch = b
            mgr.is_active = True
            mgr.is_email_verified = True
            mgr.save()
            if b.manager_id != mgr.id:
                b.manager = mgr
                b.save(update_fields=['manager'])
            self.stdout.write(self.style.SUCCESS(
                f'  sucursal admin -> {email} / 12345678  ({b.name})'
            ))

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
            # ── ZAPATILLAS Nike ──
            ('Air Force 1',        'Nike',        'zapatillas', 150, ProductTag.NEW),
            ('Air Max Plus',       'Nike',        'zapatillas', 220, ProductTag.SALE),
            ('Air Max 90',         'Nike',        'zapatillas', 175, ProductTag.NEW),
            ('Air Jordan 1 Mid',   'Nike',        'zapatillas', 230, ProductTag.DROP),
            ('Dunk Low',           'Nike',        'zapatillas', 165, ProductTag.EXCLUSIVE),
            ('Court Vintage',      'Nike',        'zapatillas', 180, ProductTag.DROP),
            ('Air Force Stealth',  'Nike',        'zapatillas', 200, ProductTag.DROP),
            # ── ZAPATILLAS Adidas ──
            ('Ultra Boost Light',  'Adidas',      'zapatillas', 200, ProductTag.DROP),
            ('Samba OG',           'Adidas',      'zapatillas', 160, ProductTag.NEW),
            ('Campus Classic',     'Adidas',      'zapatillas', 180, ProductTag.NEW),
            ('Forum Low',          'Adidas',      'zapatillas', 140, ProductTag.EXCLUSIVE),
            ('Gazelle Bold',       'Adidas',      'zapatillas', 130, ProductTag.NEW),
            ('Stan Smith',         'Adidas',      'zapatillas', 110, ''),
            # ── ZAPATILLAS otras marcas ──
            ('Pulse Runner',       'Puma',        'zapatillas', 220, ProductTag.NEW),
            ('Suede Classic',      'Puma',        'zapatillas',  90, ''),
            ('RS-X',               'Puma',        'zapatillas', 140, ProductTag.NEW),
            ('550 White',          'New Balance', 'zapatillas', 130, ProductTag.NEW),
            ('574 Core',           'New Balance', 'zapatillas', 100, ''),
            ('990v6',              'New Balance', 'zapatillas', 220, ProductTag.EXCLUSIVE),
            ('Old Skool',          'Vans',        'zapatillas',  85, ProductTag.SALE),
            ('Sk8-Hi',             'Vans',        'zapatillas',  90, ''),
            ('Authentic',          'Vans',        'zapatillas',  70, ProductTag.SALE),
            ('Heritage OG',        'Converse',    'zapatillas',  95, ProductTag.NEW),
            ('Chuck Taylor 70',    'Converse',    'zapatillas', 110, ProductTag.NEW),
            # ── ROPA ──
            ('Hoodie Tech Fleece', 'Nike',        'ropa',        95, ProductTag.NEW),
            ('Hoodie Sportswear',  'Nike',        'ropa',        85, ''),
            ('Polo Three Stripes', 'Adidas',      'ropa',        45, ''),
            ('Polo Originals',     'Adidas',      'ropa',        55, ProductTag.NEW),
            ('Camiseta Originals', 'Adidas',      'ropa',        35, ProductTag.SALE),
            ('Camiseta Just Do It','Nike',        'ropa',        40, ''),
            ('Pantalón Tech',      'Nike',        'ropa',        75, ProductTag.NEW),
            ('Pantalón Jogger',    'Puma',        'ropa',        65, ''),
            ('Campera Bomber',     'Nike',        'ropa',       140, ProductTag.DROP),
            ('Campera Track',      'Adidas',      'ropa',       120, ProductTag.NEW),
            ('Shorts Sportswear',  'Nike',        'ropa',        40, ''),
            # ── MOCHILAS ──
            ('Mochila Tech Pack',  'Puma',        'mochilas',    75, ProductTag.DROP),
            ('Mochila Originals',  'Adidas',      'mochilas',    65, ''),
            ('Mochila Heritage',   'Nike',        'mochilas',    55, ProductTag.NEW),
            ('Mochila Sportswear', 'Nike',        'mochilas',    70, ''),
            ('Mochila Casual',     'Vans',        'mochilas',    50, ProductTag.SALE),
            ('Mochila Urban',      'Converse',    'mochilas',    45, ''),
            # ── ACCESORIOS ──
            ('Gorro Snapback',     'Nike',        'accesorios',  30, ''),
            ('Gorro Originals',    'Adidas',      'accesorios',  28, ProductTag.NEW),
            ('Gorro Trucker',      'Vans',        'accesorios',  25, ''),
            ('Medias Crew Pack',   'Nike',        'accesorios',  15, ProductTag.SALE),
            ('Medias Originals',   'Adidas',      'accesorios',  18, ''),
            ('Cinturón Logo',      'Nike',        'accesorios',  35, ''),
            ('Llavero Jumpman',    'Jordan',      'accesorios',  12, ProductTag.NEW),
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
                        # Stock variado por sucursal: cada ciudad tiene un
                        # surtido distinto (algunos productos agotados en
                        # ciertas sucursales) para que la zona se note.
                        # prob = probabilidad de tener stock; rango de cantidad.
                        branch_profiles = [
                            (0.92, (6, 20)),  # 1ra sucursal: surtido amplio
                            (0.72, (3, 12)),
                            (0.60, (2, 10)),
                            (0.48, (1, 8)),   # ultima: surtido reducido
                        ]
                        for bi, branch in enumerate(branches):
                            prob, (lo, hi) = branch_profiles[bi % len(branch_profiles)]
                            qty = random.randint(lo, hi) if random.random() < prob else 0
                            Stock.objects.update_or_create(
                                tenant=tenant, variant=v, branch=branch,
                                defaults={'quantity': qty, 'min_threshold': 2},
                            )

        self.stdout.write(self.style.SUCCESS(
            f' OK {len(catalog)} productos con galeria, variantes y stock'
        ))
        self.stdout.write('Seed completado:')
        self.stdout.write(f'  Productos: {Product.objects.filter(tenant=tenant).count()}')
        self.stdout.write(f'  Imagenes:  {ProductImage.objects.filter(product__tenant=tenant).count()}')
        self.stdout.write(f'  Variantes: {Variant.objects.filter(tenant=tenant).count()}')
