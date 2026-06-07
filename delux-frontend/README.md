# delux-frontend

Frontend Angular 20 de **Delux** — Plataforma e-commerce multi-tenant multi-sucursal.

## Estructura

```
src/app/
  core/        # guards, interceptors, layouts (public + dashboard), services
  shared/      # componentes UI reutilizables (button, kpi-card, badge…)
  features/
    landing/   # Hero, drops, categorías, sucursales, etc. (dark premium)
    shop/      # Catálogo público
    auth/      # Login/registro
    dashboard/ # Admin (estilo novafactura SaaS)
```

## Levantar

```bash
npm install
npm start                 # http://localhost:4200
npm run build:prod
```

Variables en `src/environments/`. Tema dark para landing, tema claro SaaS para `/app/*`.

## Rutas principales

- `/`              Landing
- `/shop`          Catálogo público
- `/auth/login`    Login
- `/app/dashboard` Dashboard administrativo
- `/app/products`, `/app/inventory`, `/app/orders`, `/app/branches`, `/app/sales`, `/app/customers`, `/app/coupons`, `/app/reports`, `/app/marketing`, `/app/settings`
