# delux-backend

API multi-tenant multi-sucursal de **Delux** (Django 5.2 + DRF + PostgreSQL + Celery + Redis).

## Estructura

```
config/           settings (base/dev/prod), urls, asgi, wsgi, celery
apps/             monolito modular por dominio
  accounts/       Users + JWT + roles
  tenants/        Empresas (multi-tenant)
  branches/       Sucursales físicas
  brands/         Marcas
  categories/     Árbol de categorías
  products/       Producto base
  variants/       Variantes (talla, color, SKU)
  inventory/      Stock por sucursal + movimientos
  customers/      Clientes y direcciones
  carts/          Carrito persistente
  orders/         Pedidos (web + POS)
  payments/       Cobros y pasarelas
  coupons/        Cupones y promociones
common/           tenancy middleware, paginación, mixins, etc.
```

## Levantar (dev)

```bash
cp .env.example .env
docker compose up -d
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

API en `http://localhost:8000/api/v1/`, docs Swagger en `/api/docs/`.

## Multi-tenant

Cada modelo de dominio hereda de `common.models.TenantOwnedModel` (incluye `tenant_id`). El `TenantMiddleware` resuelve el tenant del request por header `X-Tenant`, subdominio o `DEFAULT_TENANT_SLUG`.

## Multi-sucursal

Stock, ventas y pedidos llevan `branch_id`. El gerente/vendedor opera sobre su sucursal.
