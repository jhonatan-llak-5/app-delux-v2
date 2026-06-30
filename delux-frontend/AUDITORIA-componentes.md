# Auditoría de componentes — Delux frontend

Objetivo: que la app sea basada en componentes, sin HTML suelto repetido, y sin componentes duplicados.

## 1) Componentes duplicados (mismo propósito)

| Componente | ¿Duplicado? | Acción |
|---|---|---|
| `dlx-ui-button` (shared/components/ui-button) | **Sí, sin uso.** El canónico es `dlx-button` (shared/ui) | Eliminar. *(No se pudo borrar automáticamente por permisos del montaje; queda inerte. Borrar manualmente la carpeta `shared/components/ui-button`.)* |
| `dlx-ui-kpi-card` | **No** — sí se usa en `dashboard-home`. Convive con `dlx-stat-card` | Mantener (o migrar dashboard-home a `dlx-stat-card` para unificar — opcional). |
| `supplier-form-modal` vs form inline de `suppliers-list` | **No son borrables** — el modal se usa en **Recepción** (crear proveedor al vuelo); el inline en la página Proveedores | Mantener ambos. |
| `dlx-confirm-dialog` (ui) vs `ConfirmService`+`confirm-host` | Conviven con propósitos distintos (declarativo vs imperativo) | Mantener ambos. |

## 2) HTML suelto repetido → extraído a componente

| Patrón | Nº archivos | Acción tomada |
|---|---|---|
| `IMG_PLACEHOLDER` redefinido localmente | 3 (landing-home, shop-list, product-detail) | ✅ landing-home y shop-list ahora **importan** de `@shared/utils/img-placeholder`. (product-detail tiene variante multilínea, pendiente.) |
| Mensaje de error de campo `@if (fe('x')) { <p class="text-xs text-rose-600 mt-1">…` | ~18 | ✅ Creado **`<dlx-field-error [error]="fe('x')" />`** (shared/ui). Pendiente: adoptarlo en los forms. |
| Buscador con lupa (`relative` + ícono + `eg-input has-icon-left`) | ~15 | ✅ Creado **`<dlx-search-input [(value)]="search" (valueChange)="…" />`** (shared/ui). Pendiente: adoptarlo en las listas. |

## 3) Ya bien componetizado (sin cambios)

- **Modales de formulario**: marca, categoría, cupón, cliente, sucursal usan `<dlx-modal>`. (Solo `supplier-form-modal` y el modal inline de direcciones usan backdrop crudo — recomendado migrar a `dlx-modal`.)
- **Manejo de imagen rota**: ya centralizado en `@shared/utils/img-placeholder` (`onImageError`, `imgOrPlaceholder`).
- **Card de resultado del kiosko**: ya es `dlx-kiosk-result-card`.
- **Badges de estado** (`eg-badge-*`), **spinners** (FontAwesome), **empty states** (`dlx-empty-state`): consistentes.

## 4) Pendiente (rollout mecánico, recomendado)

1. Adoptar `<dlx-field-error>` en los ~18 formularios (reemplaza el `<p>` repetido).
2. Adoptar `<dlx-search-input>` en las ~15 listas de superadmin.
3. Migrar `supplier-form-modal` y el modal de direcciones a `<dlx-modal>`.
4. (Opcional) unificar `dashboard-home` a `dlx-stat-card` y borrar `ui-button`/`ui-kpi-card` manualmente.
