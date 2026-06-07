# Delux — Plataforma E-commerce Multi-Tenant Multi-Sucursal

Delux es una plataforma SaaS multi-tenant orientada al retail físico-digital. Permite operar una tienda online completa, gestionar inventario por sucursal, vender en mostrador (POS), atender pedidos web, gestionar clientes y reportar resultados en tiempo real.

La primera instancia productiva pertenece a la empresa **Delux**, especializada en zapatillas (sneakers) pero con catálogo abierto a ropa, mochilas y accesorios. Delux opera con varias sucursales físicas, por lo que el sistema gestiona inventario, ventas y reportes por sucursal de manera nativa.

La plataforma nace multi-tenant para soportar más adelante otras empresas sobre la misma instalación, sin reescribir el dominio.

---

## Arquitectura General

```txt
┌────────────────────────────────────────────────────────────────┐
│                          Clientes                              │
│                                                                │
│   Landing pública      Dashboard Web (Angular 20)   App Móvil  │
│   (catálogo, shop)     (admin / sucursal / POS)     (Expo)     │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │      Nginx      │
                  │ Reverse Proxy   │
                  │ CORS · SSL      │
                  └────────┬────────┘
                           │
              ┌────────────▼────────────┐
              │   Django REST API       │
              │   Monolito Modular      │
              │   DRF + JWT + Tenant MW │
              └────────────┬────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
       PostgreSQL        Redis        Celery Worker
       Database          Cache        Background Jobs
                           │
                      Django Channels
                      WebSockets (stock live,
                      nuevas órdenes en vivo)
```

---

## Enfoque Arquitectónico

El backend se construye como un **monolito modular en Django**, separado por apps de dominio. No se inicia con microservicios para evitar complejidad innecesaria en autenticación, despliegue, logs, transacciones y comunicación entre servicios.

La arquitectura queda preparada para escalar en el futuro hacia microservicios si algún dominio crece demasiado (pagos, inventario, notificaciones, búsqueda de catálogo).

**Multi-tenant**: cada modelo de dominio incluye `tenant_id`. Un middleware resuelve el tenant a partir del subdominio (ej: `delux.app.com`) o un header `X-Tenant`. Todas las querysets se filtran por tenant en `common/tenancy/`.

**Multi-sucursal**: los modelos de inventario, ventas, transferencias y caja incluyen `branch_id`. Los usuarios con rol de gerente o vendedor están adscritos a una sucursal.

---

## Proyectos

| Proyecto | Descripción |
|---|---|
| `delux-backend` | API backend Django Rest Framework |
| `delux-frontend` | Plataforma web Angular (landing + shop + dashboards) |
| `delux-mobile` | App móvil Expo React Native |

---

## Roles del Sistema

| Rol | Descripción |
|---|---|
| Superadmin | Administra toda la plataforma multi-tenant, planes, empresas |
| Admin / Tenant | Administra la empresa Delux (catálogo, sucursales, equipo) |
| Gerente de Sucursal | Gestiona inventario, ventas y equipo de su sucursal |
| Vendedor / Cajero | Atiende ventas en mostrador (POS) y pedidos web asignados |
| Cliente | Compra online, gestiona pedidos, direcciones y wishlist |
| Invitado | Puede navegar y hacer guest checkout |

---

# 1. delux-backend — Backend API

Backend modular basado en Django Rest Framework.

## Stack Backend

- Python 3.12
- Django 5.2
- Django Rest Framework 3.15
- PostgreSQL 16
- Redis 7
- Celery 5.5
- Django Channels 4
- Daphne
- SimpleJWT
- drf-spectacular
- django-filter
- Docker Compose
- Gunicorn
- Nginx

## Arquitectura Backend

```txt
delux-backend/
│
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── dev.py
│   │   └── prod.py
│   ├── urls.py
│   ├── asgi.py
│   ├── wsgi.py
│   └── celery.py
│
├── apps/
│   ├── accounts/        # Usuarios, JWT, roles, perfil
│   ├── tenants/         # Empresas, branding, planes
│   ├── branches/        # Sucursales físicas
│   ├── brands/          # Marcas (Nike, Adidas, etc.)
│   ├── categories/      # Categorías y subcategorías
│   ├── products/        # Producto base
│   ├── variants/        # Variantes (talla, color, SKU)
│   ├── inventory/       # Stock por variante por sucursal
│   ├── media/           # Imágenes y videos de catálogo
│   ├── customers/       # Clientes registrados (CRM)
│   ├── addresses/       # Direcciones de envío
│   ├── carts/           # Carrito persistente
│   ├── orders/          # Pedidos web y POS
│   ├── payments/        # Pagos (PayPhone, tarjeta, transfer, efectivo)
│   ├── shipments/       # Envíos y BOPIS (retiro en tienda)
│   ├── coupons/         # Cupones y descuentos
│   ├── reviews/         # Valoraciones de producto
│   ├── wishlist/        # Lista de deseos
│   ├── marketing/       # Banners, drops, campañas
│   ├── analytics/       # KPIs y métricas de negocio
│   ├── notifications/   # Emails, push, in-app
│   ├── audit/           # Logs de auditoría
│   └── superadmin/      # Administración global multi-tenant
│
├── common/
│   ├── pagination/
│   ├── permissions/
│   ├── responses/
│   ├── exceptions/
│   ├── services/
│   ├── validators/
│   ├── tenancy/         # Middleware multi-tenant + querysets
│   └── utils/
│
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
│
├── docker/
├── media/
├── static/
└── manage.py
```

## Aplicaciones del Backend

| App | Responsabilidad |
|---|---|
| accounts | Login, JWT, usuarios, perfiles y roles |
| tenants | Empresas, branding y planes |
| branches | Sucursales físicas (dirección, horarios, gerente) |
| brands | Marcas comercializadas |
| categories | Árbol de categorías de productos |
| products | Producto base, descripción, marca, categoría |
| variants | Variantes de producto (talla, color, SKU, precio) |
| inventory | Stock por variante por sucursal, reservas, movimientos |
| media | Galería de imágenes y video de catálogo |
| customers | Clientes finales registrados (CRM básico) |
| addresses | Direcciones de envío y facturación |
| carts | Carrito persistente por cliente o sesión |
| orders | Pedidos: web y POS, estados, líneas, totales |
| payments | Cobros, pasarelas y conciliación |
| shipments | Envíos y retiros en tienda (BOPIS) |
| coupons | Cupones, descuentos y promociones |
| reviews | Valoraciones de producto y respuesta del tenant |
| wishlist | Productos guardados por cliente |
| marketing | Banners, drops, lanzamientos y campañas |
| analytics | Métricas de negocio (ventas, ticket promedio, top SKUs) |
| notifications | Emails transaccionales y notificaciones in-app |
| audit | Bitácora de cambios sensibles |
| superadmin | Administración global de la plataforma |

## Funcionalidades Principales

### Catálogo

- Productos con variantes (talla, color, material).
- Galería de imágenes y video corto.
- Categorías padre/hijas configurables.
- Marcas, etiquetas (nuevo, oferta, drop, exclusivo).
- SEO básico (slug, meta) por producto.
- Estados: borrador, publicado, pausado, archivado, agotado.

### Inventario

- Stock por variante y por sucursal.
- Reserva temporal al carrito (TTL configurable).
- Transferencias entre sucursales.
- Alertas de stock mínimo.
- Auditoría de movimientos.

### Ventas online (e-commerce)

- Catálogo público.
- Carrito persistente (registrado e invitado).
- Checkout con envío o retiro en tienda.
- Pagos: PayPhone, tarjeta, transferencia, efectivo (POS).
- Cupones y promociones.
- Seguimiento de pedido.
- Devoluciones y notas de crédito.

### Ventas en tienda (POS)

- Búsqueda rápida por SKU, código de barras o nombre.
- Carrito de mostrador.
- Cobro mixto.
- Impresión de comprobante.
- Caja por turno por vendedor.

### Clientes

- Registro y login (email, social opcional).
- Direcciones múltiples.
- Historial de pedidos.
- Wishlist.
- Reseñas.

### Sucursales

- Alta de sucursales con dirección, teléfono, horarios, gerente.
- Asignación de equipo por sucursal.
- Configuración de retiro en tienda.

### Administración / Tenant

- Catálogo completo.
- Inventario centralizado.
- Pedidos por estado.
- Equipo y roles.
- Branding (logo, colores, dominios).
- Reportes y exportación.

### Superadmin

- Gestión de empresas (tenants).
- Planes y facturación de la plataforma.
- Métricas globales.
- Configuración general.
- Auditoría básica.

## Variables de Entorno Backend

```env
DEBUG=False

SECRET_KEY=super_secret_key

ALLOWED_HOSTS=localhost,127.0.0.1,api.delux.local

DB_NAME=delux
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=postgres
DB_PORT=5432

REDIS_HOST=redis
REDIS_PORT=6379

JWT_SECRET_KEY=jwt_secret

FRONTEND_URL=http://localhost:4200
CORS_ALLOWED_ORIGINS=http://localhost:4200

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

PAYPHONE_TOKEN=
PAYPHONE_STORE_ID=

STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=delux-media
AWS_S3_REGION_NAME=us-east-1

DEFAULT_TENANT_SLUG=delux
```

## Dependencias Principales

```txt
Django==5.2
djangorestframework==3.15.2
djangorestframework-simplejwt==5.5.0
django-cors-headers==4.7.0
django-filter==24.3
psycopg[binary]==3.2.9

celery==5.5.3
redis==6.2.0

channels==4.2.2
channels-redis==4.2.1
daphne==4.2.1

gunicorn==23.0.0

Pillow==11.2.1
drf-spectacular==0.28.0

boto3==1.38.0
django-storages==1.14.6
```

## API Base URL

```txt
http://localhost:8000/api/v1/
```

## Endpoints Principales

| Endpoint | Descripción |
|---|---|
| `/api/v1/auth/` | Login, refresh token y sesión |
| `/api/v1/tenants/` | Empresas (superadmin) |
| `/api/v1/branches/` | Sucursales del tenant |
| `/api/v1/brands/` | Marcas |
| `/api/v1/categories/` | Categorías y árbol |
| `/api/v1/products/` | Catálogo de productos |
| `/api/v1/variants/` | Variantes por producto |
| `/api/v1/inventory/` | Stock por sucursal |
| `/api/v1/customers/` | Clientes |
| `/api/v1/addresses/` | Direcciones del cliente |
| `/api/v1/carts/` | Carrito persistente |
| `/api/v1/orders/` | Pedidos |
| `/api/v1/payments/` | Pagos y conciliación |
| `/api/v1/shipments/` | Envíos y retiros en tienda |
| `/api/v1/coupons/` | Cupones y promociones |
| `/api/v1/reviews/` | Reseñas |
| `/api/v1/wishlist/` | Lista de deseos |
| `/api/v1/marketing/` | Banners y drops |
| `/api/v1/analytics/` | Métricas y KPIs |
| `/api/v1/notifications/` | Notificaciones |
| `/api/v1/admin/` | Superadmin global |

## Uso de Celery

- Envío de correos transaccionales (orden creada, pagada, enviada).
- Generación de comprobantes y reportes PDF.
- Procesamiento y resize de imágenes de catálogo.
- Reportes Excel.
- Sincronización de inventario.
- Notificaciones programadas y recordatorios.
- Limpieza de carritos abandonados.
- Reindexado de catálogo.

## Uso de WebSockets

Django Channels se usa solo cuando exista una necesidad real de tiempo real:

- Notificaciones en vivo de nuevas órdenes web en el dashboard de sucursal.
- Actualización de stock en vivo cuando hay venta concurrente.
- Mensajería interna y atención al cliente.
- Eventos administrativos.

No todo debe usar WebSockets. Para CRUD, catálogo, reportes y operaciones normales se usa HTTP REST.

---

# 2. delux-frontend — Plataforma Web

Frontend web basado en Angular 20 que cubre tres experiencias en un mismo proyecto:

1. **Landing pública + Shop** (tema DARK premium estilo Adidas/Nike).
2. **Cuenta del cliente** (mis pedidos, perfil, wishlist).
3. **Dashboards internos** (admin tenant, sucursal, vendedor) con estética SaaS profesional inspirada en novafactura-frontend (sidebar, topbar, KPIs, tablas densas, charts).

## Stack Frontend

- Angular 20
- TypeScript 5.8
- TailwindCSS 4
- Angular Signals
- RxJS 7.8
- Angular Router
- Angular HttpClient
- Angular Guards
- Angular Interceptors
- ngx-toastr
- ApexCharts
- Angular CDK
- Lucide Angular
- Swiper (carruseles de producto)
- GSAP / Angular Animations (microinteracciones landing)
- Standalone Components
- Lazy Loading

## Arquitectura Frontend

```txt
src/
│
├── app/
│   ├── core/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── layouts/
│   │   │   ├── public-layout/      # Landing + shop (dark premium)
│   │   │   ├── account-layout/     # Mi cuenta cliente
│   │   │   └── dashboard-layout/   # SaaS estilo novafactura
│   │   ├── services/
│   │   ├── store/
│   │   └── tokens/
│   │
│   ├── shared/
│   │   ├── components/
│   │   ├── directives/
│   │   ├── pipes/
│   │   └── models/
│   │
│   ├── features/
│   │   ├── landing/
│   │   ├── auth/
│   │   ├── shop/
│   │   ├── product/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── account/
│   │   ├── orders/
│   │   ├── wishlist/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── branches/
│   │   ├── sales/        # POS
│   │   ├── customers/
│   │   ├── coupons/
│   │   ├── reports/
│   │   ├── marketing/
│   │   ├── settings/
│   │   └── superadmin/
│   │
│   ├── app.config.ts
│   ├── app.routes.ts
│   └── app.component.ts
│
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
```

## Variables de Entorno Frontend

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api/v1',
  wsUrl: 'ws://localhost:8001/ws',
  tenant: 'delux'
};
```

## Módulos Principales Frontend

| Módulo | Descripción |
|---|---|
| Landing | Hero dark premium con drops destacados |
| Auth | Login, registro y recuperación |
| Shop | Catálogo público con filtros |
| Product | Detalle de producto con variantes |
| Cart | Carrito persistente |
| Checkout | Envío, pago y confirmación |
| Account | Mi cuenta cliente |
| Orders | Historial y seguimiento |
| Wishlist | Lista de deseos |
| Dashboard | KPIs internos por rol |
| Products | Gestión de catálogo |
| Inventory | Stock por sucursal |
| Branches | Gestión de sucursales |
| Sales | POS para mostrador |
| Customers | CRM |
| Coupons | Cupones y promociones |
| Reports | Reportes Excel/PDF |
| Marketing | Banners y drops |
| Settings | Configuración del tenant |
| Superadmin | Administración global |

---

# 3. delux-mobile — App Móvil

App móvil para clientes finales.

## Stack Mobile

- Expo SDK 53
- React Native 0.79
- TypeScript
- Expo Router
- NativeWind
- Axios

## Funcionalidades Mobile

- Login y registro.
- Catálogo y búsqueda.
- Detalle de producto con variantes.
- Carrito.
- Checkout.
- Historial de pedidos.
- Wishlist.
- Notificaciones push.
- Perfil y direcciones.

---

# Docker Compose

```yaml
services:

  backend:
    build: .
    container_name: delux_backend
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  celery:
    build: .
    container_name: delux_celery
    command: celery -A config worker -l info
    volumes:
      - .:/app
    depends_on:
      - redis
      - postgres

  celery-beat:
    build: .
    container_name: delux_celery_beat
    command: celery -A config beat -l info
    volumes:
      - .:/app
    depends_on:
      - redis

  websocket:
    build: .
    container_name: delux_websocket
    command: daphne -b 0.0.0.0 -p 8001 config.asgi:application
    ports:
      - "8001:8001"
    depends_on:
      - redis

  postgres:
    image: postgres:16-alpine
    container_name: delux_postgres
    environment:
      POSTGRES_DB: delux
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: delux_redis
    ports:
      - "6379:6379"
```

---

# Cómo Ejecutar Localmente

## Backend

```bash
docker compose up -d

docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py seed_delux   # tenant + sucursales demo
```

## Frontend

```bash
cd delux-frontend
npm install
ng serve
```

## Mobile

```bash
cd delux-mobile
npm install
npm start
```

---

# Producción VPS

## Requisitos

- Ubuntu 24.04+
- Docker / Docker Compose
- PostgreSQL 16
- Redis 7
- Nginx
- Certbot SSL

## Despliegue Básico

```bash
git pull
docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py collectstatic --noinput
```

---

# Tecnologías Principales

| Categoría | Tecnología |
|---|---|
| Backend | Python 3.12 + Django 5.2 + DRF 3.15 |
| Frontend | Angular 20 + TailwindCSS 4 |
| Mobile | Expo SDK 53 |
| Base de datos | PostgreSQL 16 |
| Tareas en segundo plano | Celery + Redis |
| Tiempo real | Django Channels |
| Infraestructura | Docker + Nginx |
| Auth | JWT |
| Cache | Redis |
| Storage | S3 compatible o almacenamiento local |
