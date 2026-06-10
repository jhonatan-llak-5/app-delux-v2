# Guía de refactor a componentes — Delux Frontend

## Librería UI compartida (`src/app/shared/ui/`)

| Componente | Propósito |
|---|---|
| `<dlx-page-header>` | Header de página: eyebrow + h1 + subtitle + slot acciones |
| `<dlx-button>` | Botón polimórfico (variant + size + loading) |
| `<dlx-input>` | Input con label/hint/error/iconLeft/iconRight |
| `<dlx-textarea>` | Textarea con label/hint/error |
| `<dlx-select>` | Select con options array |
| `<dlx-toggle>` | Switch on/off con label |
| `<dlx-card>` | Card con title/subtitle opcional |
| `<dlx-stat-card>` | KPI box con icon coloreado |
| `<dlx-tabs>` | Tabs horizontales con underline |
| `<dlx-action-btn>` | Botón icon-only para tablas |
| `<dlx-extension-pill>` | Pill toggleable de colores |
| `<dlx-file-upload>` | Upload genérico (single file con preview) |
| `<dlx-image-uploader>` | **Drag&drop + URL mixto** + galería ordenable + main toggle |
| `<dlx-empty-state>` | Placeholder lista vacía |
| `<dlx-modal>` | Modal genérico |
| `<dlx-confirm-dialog>` | Confirmación delete/warning |
| `<dlx-table>` | **Tabla genérica con columns + rows + paginación + custom cells** |
| `<dlx-pagination>` | Pagina con page-size selector (25/50/100) |
| `<dlx-notifications-bell>` | Bell + dropdown + badge contador + sonido + animación |

Import único: `import { ... } from '@shared/ui';`

## Patrón estándar de tabla

```typescript
import { DlxTableComponent, DlxTableColumn, DlxActionBtnComponent } from '@shared/ui';

readonly cols: DlxTableColumn[] = [
  { key: 'name', label: 'Producto' },
  { key: 'sku',  label: 'SKU' },
  { key: 'branch.name', label: 'Sucursal' },
  { key: 'stock', label: 'Stock', align: 'right' },
];

// Estado
page = signal(1);
size = signal(25);
total = signal(0);
rows = signal<Item[]>([]);
loading = signal(false);

onPage(p: number) { this.page.set(p); this.reload(); }
onSize(s: number) { this.size.set(s); this.page.set(1); this.reload(); }

reload() {
  this.loading.set(true);
  this.svc.list({ page: this.page(), page_size: this.size() })
    .subscribe(r => {
      this.rows.set(r.results);
      this.total.set(r.count);
      this.loading.set(false);
    });
}
```

```html
<dlx-table
  [columns]="cols" [rows]="rows()" [total]="total()" [loading]="loading()"
  [page]="page()" [pageSize]="size()"
  (pageChange)="onPage($event)" (pageSizeChange)="onSize($event)">
  <ng-template #actions let-row>
    <dlx-action-btn icon="fa-pen" (clicked)="edit(row)" />
    <dlx-action-btn icon="fa-trash" [danger]="true" (clicked)="confirmDelete(row)" />
  </ng-template>
</dlx-table>
```

## Backend: paginación DRF

Asegurar en `config/settings/base.py`:
```python
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
}
```

Permitir override de `page_size`:
```python
class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100
```

## Notificaciones en tiempo real

**Frontend** ya tiene `NotificationsService` (`@shared/services/notifications.service.ts`).
- Suscribe al WebSocket existente, agrega notificaciones al signal `list`
- Reproduce sonido (WebAudio beep), pulse del bell, toast informativo
- Persiste en localStorage (`dlx_notifs_v1`)
- Badge en `<dlx-notifications-bell>` ya está integrado en dashboard layout

**Backend** ya tiene:
- `apps/notifications/realtime.py` → helper `push_admin_notification(type, title, message, link, meta)`
- `apps/notifications/signals.py` → escucha `post_save` de `User`, `Order`, `Stock`
- `apps/notifications/apps.py` → ready() registra signals

**Tipos de evento**: `sale_created`, `user_registered`, `low_stock`, `order_placed`, `review_posted`

Para emitir desde una vista custom:
```python
from apps.notifications.realtime import push_admin_notification

push_admin_notification(
    type='review_posted',
    title='Nueva reseña',
    message=f'{user} dejó una reseña en {product}',
    link='/app/admin/reviews',
)
```

## Páginas pendientes de migrar a componentes

### Migración a `<dlx-table>` + paginación
- [ ] `inventory-overview` — tabla de stock con paginación
- [ ] `sales-list` — tabla de ventas
- [ ] `shipments-list` — tabla envíos
- [ ] `users-list` — tabla usuarios
- [ ] `customers-list` — tabla clientes
- [ ] `coupons-list` — tabla cupones
- [ ] `staff-list` — tabla equipo
- [ ] `admin-orders` — tabla órdenes
- [ ] `admin-returns` — tabla devoluciones
- [ ] `admin-reviews` — tabla reseñas

### Migración a `<dlx-image-uploader>`
- [ ] `product-form-modal` — reemplazar el input URL único por uploader mixto
- [ ] `category-form-modal` — para icono/banner
- [ ] `tenant-form-modal` — logo
- [ ] `brand-form-modal` — logo + logo_dark

### Otros pendientes
- [ ] Reports stock-bajo → cada producto link a `/app/admin/inventory?product=X`
- [ ] Form de producto: añadir bloque "Stock por sucursal" embebido (3 inputs)
- [ ] Backend: emitir `low_stock` cuando units <= min_level en signal (ya implementado)
- [ ] Backend: emitir `sale_created` cuando channel='POS' (ya implementado)

## Cómo añadir una notificación en frontend (debug/testing)

```typescript
import { NotificationsService } from '@shared/services/notifications.service';

const notif = inject(NotificationsService);
notif.push({
  kind: 'sale',
  title: 'Venta de prueba',
  message: 'POS-20260608-0042 · Total $250',
  link: '/app/admin/sales',
});
```

