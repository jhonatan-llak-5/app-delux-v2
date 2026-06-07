# Plan de trabajo — Delux

Plataforma e-commerce **multi-tenant** y **multi-sucursal** orientada a la venta de zapatillas (sneakers), ropa, mochilas y accesorios. La primera instancia productiva pertenece a la empresa **Delux** con su sucursal matriz en Quito y 5 sucursales adicionales.

---

## Tres perfiles del sistema

### 1. Superadmin (corporativo)
Acceso total a la plataforma. Su panel cubre:
- Visión global multi-sucursal (KPIs, ventas consolidadas, top productos).
- Gestión de **sucursales** (alta, baja, designar admin de sucursal, sucursal matriz).
- Gestión de **marcas comercializadas** (Nike, Adidas, Puma, etc.).
- Gestión de **categorías y subcategorías globales** (zapatillas → running, lifestyle, skate; ropa → hoodies, polos; mochilas → urbana, deportiva; accesorios → medias, gorros).
- Gestión de **usuarios** (clientes, admins de sucursal, vendedores). Suspender, activar.
- **Configuración del sistema** (SMTP, branding, expiraciones, IVA, monedas).
- **Configuración de PayPhone** (credenciales, token, store ID, modo sandbox/prod).
- Configuración de otras pasarelas (Stripe, transferencia bancaria).
- **Reportes globales** consolidados (ventas, inventario, clientes, comportamiento).
- Auditoría y logs del sistema.

### 2. Admin de sucursal
Cada sucursal tiene su propio admin. Su panel cubre solo lo de **su sucursal**:
- Dashboard de su sucursal (ventas del día/mes, top SKUs, alertas stock).
- **Gestión de mercadería e inventario** (entradas, ajustes, transferencias entre sucursales).
- **Gestión del catálogo de su sucursal** (qué productos del catálogo global vende ahí, precios locales si aplica).
- **Subida de productos** a partir del catálogo global y carga masiva (CSV/Excel).
- **Asignación de stock** por variante (talla, color).
- **Gestión de vendedores** de la sucursal (alta limitada a su sucursal, asignación de turnos).
- **Horarios de atención** de la sucursal.
- **Ventas** (web asignadas, POS en mostrador, devoluciones).
- **Generación de comprobantes de venta** (factura, nota de venta).
- **Reportes** de su sucursal (ventas, stock, comisiones de vendedores).
- Exportación a Excel/PDF.

### 3. Cliente
Solo este perfil se puede crear desde el app (registro público con activación por email). Su experiencia:
- Catálogo completo con filtros (categoría, marca, talla, color, precio, sucursal).
- Detalle de producto con galería estilo Nike, variantes, reseñas.
- **Carrito de compras**.
- **Wishlist** (favoritos).
- **Perfil**: datos personales, preferencias (talla, marcas favoritas), direcciones.
- **Historial de compras** (pedidos web y POS asociados a su email).
- **Reseñas** de productos comprados.
- **Compra online** con pago vía PayPhone, tarjeta o transferencia.
- **Retiro en sucursal** (BOPIS) o envío a domicilio.
- Notificaciones por email del estado de su pedido.

> **Importante**: Admins de sucursal y vendedores NO se registran desde el app. Solo el Superadmin (o un Admin de sucursal para vendedores de su sucursal) puede crear estas cuentas.

---

## Sprints

> Estado actual al iniciar este plan: **Sprints 1, 2, 3 (parcial), Theme + Auth + Páginas públicas** ya completados.

---

# FASE A — Base y administración corporativa (Superadmin)

## Sprint 1 ✅ — Estructura, landing, tema y splash
Base Angular 20 + Django 5.2 + Docker. Landing page editorial con hero animado en 2 fases (explore + showcase), gradiente fluido, splash intro, scroll reveal. Sistema dark/light. Páginas Shop, Contact, Product Detail estructuradas.

## Sprint 2 ✅ — Autenticación y activación
Registro de cliente, login, activación por código de 6 dígitos vía email, recuperación de contraseña, JWT, guards y roles base (SUPERADMIN, TENANT_ADMIN, BRANCH_MANAGER, SALESPERSON, CUSTOMER).

## Sprint 3 ✅ — Panel Superadmin base
Dashboard global, listado de tenants/sucursales/usuarios, configuración SMTP, prueba de correo. Endpoints `/admin/users/`, `/admin/tenants/`, `/admin/branches/`, `/admin/settings/`.

## Sprint 4 — Gestión de marcas (Superadmin)
**Backend:**
- CRUD completo de Brand (nombre, slug, logo URL, descripción, país de origen, activa/inactiva).
- Subida de logo (S3 o storage local).
- Endpoint `/api/v1/admin/brands/` con paginación, búsqueda, ordering.

**Frontend (Superadmin):**
- Página `/app/admin/brands` con grid de cards de marcas (logo, nombre, conteo de productos).
- Modal de crear/editar marca.
- Toggle activar/desactivar.
- Confirmación de eliminación con dependencias.

**Entregable:** Superadmin puede agregar todas las marcas que Delux comercializa.

---

## Sprint 5 — Gestión de categorías globales (Superadmin)
**Backend:**
- Categoría jerárquica (padre/hijos) con campo `parent`.
- Slug único por tenant.
- Icono o imagen representativa.
- Orden de aparición.
- Endpoint `/api/v1/admin/categories/` con árbol anidado.

**Frontend (Superadmin):**
- Página `/app/admin/categories` con vista árbol drag-and-drop.
- Crear categorías raíz y subcategorías.
- Editar nombre, icono, orden, parent.
- Activar/desactivar.
- Indicador de cuántos productos hay en cada categoría.

**Categorías iniciales (seed):**
- Zapatillas → Running, Lifestyle, Skate, Basket, Fútbol, Outdoor
- Ropa → Hoodies, Polos, Pantalones, Shorts, Camperas
- Mochilas → Urbana, Deportiva, Casual
- Accesorios → Medias, Gorros, Cinturones, Llaveros

**Entregable:** Estructura del catálogo lista para alojar productos.

---

## Sprint 6 — Productos base (Superadmin)
**Backend:**
- CRUD de Product con: nombre, slug, descripción corta y larga, marca, categoría, género (men/women/unisex/kids), precio base, precio compare-at, tags, estado (DRAFT/PUBLISHED/PAUSED/ARCHIVED), SEO meta.
- Galería de imágenes (múltiples).
- Endpoint `/api/v1/admin/products/` con filtros por marca, categoría, estado.

**Frontend (Superadmin):**
- Página `/app/admin/products` con tabla densa (imagen, nombre, marca, categoría, precio, estado, acciones).
- Filtros por marca, categoría, estado.
- Búsqueda con debounce.
- Wizard de creación de producto (paso 1: básicos, paso 2: imágenes, paso 3: SEO).
- Editor de descripción con formato.
- Drag-and-drop de imágenes.
- Vista previa de cómo se verá en el catálogo público.

**Entregable:** Catálogo global de productos publicable.

---

## Sprint 7 — Variantes de producto (Superadmin)
**Backend:**
- Variant con: SKU único, talla, color, material, precio_override, código de barras, peso.
- Validaciones para evitar SKU duplicado.

**Frontend (Superadmin):**
- En el detalle del producto, sección "Variantes" con tabla.
- Generador automático de variantes (combinaciones talla × color).
- Importar SKUs desde CSV.
- Editar precio individual de variante (override).

**Entregable:** Productos completos y vendibles por variante específica.

---

## Sprint 8 — Sucursales y sucursal matriz (Superadmin)
**Backend:**
- Sucursal con campo `is_headquarters` (matriz única por tenant).
- Geolocalización (lat/lng), horarios estructurados, foto, descripción.
- Manager (admin de sucursal).
- Toggle "permite retiro en tienda" (BOPIS).

**Frontend (Superadmin):**
- Página `/app/admin/branches` con cards de sucursales.
- Crear sucursal con datos completos.
- Marcar una como **matriz** (badge especial).
- Asignar manager (admin de sucursal) desde lista de usuarios con rol BRANCH_MANAGER.
- Mapa interactivo para colocar coordenadas.
- Vista pública de la sucursal en la landing.

**Seed:** Delux Centro (matriz, Quito), Norte (Quito), Mall (Guayaquil), Cuenca, Outlet, Manta.

**Entregable:** Sucursales operativas con sus admins asignados.

---

## Sprint 9 — Cuentas de admin de sucursal (creación desde Superadmin)
**Backend:**
- Endpoint `/api/v1/admin/users/create-branch-manager/` que crea User con rol `BRANCH_MANAGER` asignado a una sucursal.
- Email automático de bienvenida con credenciales temporales.
- Forzar cambio de contraseña en primer login.

**Frontend (Superadmin):**
- Botón "Crear admin de sucursal" en página de sucursales.
- Form con email, nombre, sucursal asignada.
- Reset de contraseña desde panel.
- Auditoría: cuándo se creó, último login.

**Entregable:** Cada sucursal tiene su admin operativo.

---

## Sprint 10 — Pasarelas de pago (Superadmin)
**Backend:**
- App `payments_config` con modelo `PaymentGateway` (PayPhone, Stripe, Transferencia, Efectivo).
- Cada gateway con sus credenciales encriptadas (Fernet).
- Configuración global: monedas aceptadas, IVA, comisiones.
- Endpoint `/api/v1/admin/payment-gateways/`.

**Frontend (Superadmin):**
- Página `/app/admin/payments/gateways` con tabs por pasarela.
- **PayPhone**: token, store ID, modo sandbox/producción, URL de callback. Botón "Probar conexión".
- **Stripe**: public_key, secret_key, webhook secret.
- **Transferencia**: cuentas bancarias receptoras (banco, número, titular).
- **Efectivo**: solo en POS sucursal.
- Switch activar/desactivar por pasarela.

**Entregable:** PayPhone listo para procesar pagos reales.

---

# FASE B — Panel admin de sucursal

## Sprint 11 — Dashboard del admin de sucursal
**Backend:**
- Middleware que detecta el `branch_id` del admin logueado y filtra todo a su sucursal.
- Endpoints `/api/v1/branch/dashboard/` con KPIs de su sucursal.

**Frontend (Admin sucursal):**
- Layout `dashboard-layout` muestra solo grupos relevantes a su rol (Catálogo de su sucursal, Inventario, Ventas, Vendedores, Reportes).
- Dashboard inicial con: ventas hoy, ventas mes, pedidos pendientes, alertas stock crítico, top SKUs.
- Charts comparativos (Chart.js).

**Entregable:** Admin de sucursal tiene su panel operativo.

---

## Sprint 12 — Inventario y stock por sucursal
**Backend:**
- App `inventory` ya existente: Stock(variant, branch, quantity, reserved, min_threshold).
- StockMovement (IN, OUT, ADJ, XFER_IN, XFER_OUT, RESERVE, RELEASE).
- Transferencias entre sucursales con flujo de aprobación.
- Endpoint `/api/v1/branch/inventory/` filtrado a su sucursal.

**Frontend (Admin sucursal):**
- Página `/app/inventory` con tabla de variantes (SKU, producto, talla, color, stock disponible, reservado, mínimo, acciones).
- Acción "Entrada de mercadería" (modal con cantidad + nota).
- Acción "Ajuste de inventario".
- Acción "Transferir a otra sucursal".
- Alertas visuales para stock crítico.
- Historial de movimientos por variante.

**Entregable:** Sucursal gestiona su mercadería sola.

---

## Sprint 13 — Carga masiva de productos y stock
**Backend:**
- Endpoint `/api/v1/branch/products/import-csv/` que recibe CSV y crea/actualiza productos/variantes/stock en bulk.
- Validación previa con errores línea por línea.
- Plantilla descargable.

**Frontend (Admin sucursal):**
- Botón "Importar CSV" en página de productos.
- Drag-and-drop del archivo.
- Vista previa con errores destacados.
- Confirmación de filas válidas.
- Log de importación.

**Entregable:** Onboarding rápido de catálogo masivo.

---

## Sprint 14 — Gestión de vendedores de sucursal
**Backend:**
- Endpoint `/api/v1/branch/sellers/` para CRUD de users con rol `SALESPERSON` asociados a la sucursal del admin.
- Solo el admin de sucursal y el superadmin pueden crear vendedores.
- Comisión configurable por vendedor.

**Frontend (Admin sucursal):**
- Página `/app/sellers` con tabla de vendedores (nombre, email, turnos, ventas del mes, comisión).
- Crear vendedor (modal).
- Asignar turnos.
- Suspender/activar.

**Entregable:** Sucursal con equipo de ventas estructurado.

---

## Sprint 15 — Horarios de atención de sucursal
**Backend:**
- Modelo `BranchSchedule` con días de la semana, hora apertura/cierre, descansos.
- Estados especiales (cerrado por feriado).

**Frontend (Admin sucursal):**
- Página `/app/settings/schedule` con calendario semanal editable.
- Configurar horarios por día.
- Calendario de excepciones (feriados, vacaciones).
- Sincronización automática a la landing pública.

**Entregable:** Horarios visibles al cliente y sincronizados.

---

# FASE C — Cliente y catálogo público

## Sprint 16 — Registro y onboarding del cliente
**Backend:**
- Ya implementado (Sprint 2): registro con activación por código.
- Bloquear registro de roles distintos a CUSTOMER desde el app.
- Onboarding: preguntas opcionales sobre talla y marcas favoritas.

**Frontend (Cliente):**
- Página `/auth/register` ya existente (refinar).
- Después de activación: wizard de bienvenida (3 pasos: talla, marcas favoritas, categoría preferida).

**Entregable:** Onboarding cliente fluido.

---

## Sprint 17 — Perfil y preferencias del cliente
**Backend:**
- Endpoint `/api/v1/me/profile/` (GET/PATCH).
- Preferencias: tallas favoritas, marcas, categorías, género preferido.
- Direcciones (CRUD).

**Frontend (Cliente):**
- Página `/account/profile` con datos personales, foto, contraseña.
- Tab "Preferencias" para editar tallas y marcas favoritas (mejora recomendaciones).
- Tab "Direcciones" con lista y form de alta.
- Tab "Notificaciones" (configurar qué emails recibir).

**Entregable:** Cliente con perfil completo.

---

## Sprint 18 — Catálogo público con filtros ✅ (UI hecha)
**Backend pendiente:**
- Endpoint público `/api/v1/products/` con filtros facetados (categoría, marca, talla, color, precio, sucursal disponible).
- Conteo dinámico por filtro.
- Búsqueda con debounce.
- Indicador "Stock en X sucursales".

**Frontend:**
- Conectar UI ya existente al backend.
- Skeleton loading.
- Estado vacío.

**Entregable:** Catálogo navegable con stock real.

---

## Sprint 19 — Detalle de producto y reseñas ✅ (UI hecha)
**Backend pendiente:**
- Endpoint `/api/v1/products/{slug}/` con todas las variantes, galería, stock por sucursal.
- App `reviews`: Review(customer, product, rating, title, text, verified, helpful_count).
- Solo clientes con orden entregada pueden reseñar.
- Endpoint `/api/v1/products/{slug}/reviews/`.

**Frontend:**
- Conectar UI de galería tipo Nike al backend.
- Conectar componente Reviews al backend.

**Entregable:** Producto con info real y reseñas verificadas.

---

## Sprint 20 — Carrito de compras
**Backend:**
- App `carts` ya existente.
- Carrito persistente: invitado (session_key) o registrado (customer_id).
- Fusión automática al iniciar sesión.
- Reserva temporal de stock (TTL 30 min).
- Endpoints `/api/v1/cart/`, `/api/v1/cart/items/`, `/api/v1/cart/apply-coupon/`.

**Frontend (Cliente):**
- Mini-cart en navbar con conteo.
- Página `/cart` con líneas editables (cantidad, talla, color).
- Resumen de totales en vivo.
- Botón "Guardar para después" (mueve a wishlist).
- CTA "Ir a pagar".

**Entregable:** Cliente puede llenar carrito.

---

## Sprint 21 — Wishlist (favoritos)
**Backend:**
- App `wishlist` con WishlistItem(customer, product_or_variant).
- Endpoint `/api/v1/wishlist/`.

**Frontend (Cliente):**
- Botón corazón en cada producto del catálogo y detalle.
- Página `/account/wishlist` con grid de favoritos.
- Mover a carrito desde wishlist.

**Entregable:** Cliente guarda sus deseos.

---

## Sprint 22 — Historial de compras del cliente
**Backend:**
- Endpoint `/api/v1/me/orders/` con lista paginada.
- Endpoint `/api/v1/me/orders/{code}/` con detalle.
- Timeline de estados del pedido.

**Frontend (Cliente):**
- Página `/account/orders` con tabla.
- Filtros por estado.
- Detalle de cada pedido con timeline, ítems, total, dirección, comprobante descargable.
- Acción "Volver a comprar".

**Entregable:** Cliente ve toda su historia con Delux.

---

# FASE D — Checkout y pagos

## Sprint 23 — Direcciones del cliente
**Backend:**
- App `addresses` (CRUD).
- Validación de ciudad/región/CP.

**Frontend:**
- Tab dentro de `/account/profile`.
- Form con campos: alias, calle, ciudad, región, código postal, país, referencia.
- Marcar como dirección predeterminada.

**Entregable:** Direcciones reutilizables en checkout.

---

## Sprint 24 — Checkout multi-paso
**Backend:**
- Endpoint `/api/v1/checkout/` que toma carrito + datos + dirección + método pago y crea Order en estado PENDING.
- Validación de stock antes de crear orden.
- Reserva firme de stock.

**Frontend (Cliente):**
- Página `/checkout` con stepper (Datos → Envío → Pago → Confirmación).
- **Paso 1 Datos**: si invitado pedir email y nombre.
- **Paso 2 Envío**: elegir entre "Envío a domicilio" o "Retiro en sucursal". Si envío, elegir dirección o agregar nueva. Si retiro, elegir sucursal.
- **Paso 3 Pago**: elegir método (PayPhone tarjeta, Transferencia, Efectivo si retiro).
- **Paso 4 Confirmación**: resumen.

**Entregable:** Cliente listo para pagar.

---

## Sprint 25 — Integración PayPhone (pago real)
**Backend:**
- Helper `PayPhoneClient` usando la configuración del Superadmin (Sprint 10).
- Endpoint `/api/v1/checkout/initiate-payment/` que llama PayPhone API y devuelve URL de redirección o formulario.
- Webhook `/api/v1/webhooks/payphone/` para confirmar/rechazar pago.
- Estado de Order pasa a PAID al confirmar.

**Frontend (Cliente):**
- En paso 3 de checkout, integración con SDK de PayPhone o redirección.
- Página `/checkout/success` con confirmación.
- Página `/checkout/failed` con opción de reintentar.

**Entregable:** Cliente paga con tarjeta real vía PayPhone.

---

## Sprint 26 — Transferencia bancaria y otros métodos
**Backend:**
- Para transferencia: orden queda en PENDING_TRANSFER, cliente sube comprobante.
- Endpoint `/api/v1/orders/{id}/upload-receipt/`.
- Admin de sucursal valida y aprueba.

**Frontend:**
- Mostrar datos bancarios (configurados en Sprint 10).
- Upload de comprobante.
- Estado "Esperando confirmación".

**Entregable:** Pagos por transferencia funcionales.

---

## Sprint 27 — Emails transaccionales del flujo de compra
**Backend (Celery):**
- `order_created.html` — confirmación al cliente.
- `order_paid.html` — pago confirmado.
- `order_shipped.html` — pedido en camino.
- `order_delivered.html` — entregado.
- `order_ready_pickup.html` — listo para retirar (BOPIS).
- Plantillas usando branding del tenant (logo, colores).

**Frontend:**
- N/A (emails).

**Entregable:** Cliente recibe notificaciones en cada hito.

---

# FASE E — Operación de ventas (Admin sucursal y vendedores)

## Sprint 28 — Pedidos web en el admin de sucursal
**Backend:**
- Pedidos web se asignan automáticamente a la sucursal según: dirección de envío, sucursal con stock, o sucursal matriz por defecto.
- Endpoint `/api/v1/branch/orders/` filtrado a la sucursal.

**Frontend (Admin sucursal):**
- Página `/app/orders` con tabla de pedidos web.
- Filtros (estado, fecha, canal, cliente).
- Acciones: marcar como preparando, listo, despachado.
- Generación de etiqueta de envío.
- Cancelación con motivo.

**Entregable:** Sucursal opera sus pedidos web.

---

## Sprint 29 — POS / Ventas en mostrador
**Backend:**
- Endpoint `/api/v1/branch/pos/sale/` para crear venta POS.
- Cobro inmediato (efectivo o tarjeta presente).
- Caja por turno por vendedor.

**Frontend (Vendedor):**
- Página `/app/sales` con vista POS optimizada touch.
- Búsqueda rápida por SKU o código de barras (con teclado físico de barras).
- Carrito de mostrador.
- Selección de método de pago.
- Apertura y cierre de caja.
- Impresión de comprobante (web printer).

**Entregable:** Venta presencial integrada.

---

## Sprint 30 — Generación de comprobantes
**Backend:**
- App `vouchers` con tipos: Factura, Nota de venta, Nota de crédito.
- Generación de PDF con ReportLab.
- Numeración secuencial por sucursal.
- Endpoint `/api/v1/orders/{id}/voucher/` (PDF descargable).

**Frontend:**
- Botón "Imprimir comprobante" en orden.
- Vista preview del comprobante.
- Para cliente: descargable desde su historial.

**Entregable:** Comprobantes válidos para cada venta.

---

## Sprint 31 — Facturación electrónica SRI Ecuador
**Backend:**
- Integración con SRI (firma electrónica del emisor).
- Generación de RIDE (PDF) y XML firmado.
- Envío automático al SRI para autorización.
- Reintentos en background con Celery.

**Frontend (Admin sucursal):**
- Configuración de certificado.
- Vista de comprobantes autorizados / rechazados con motivo.

**Entregable:** Cumplimiento fiscal completo.

---

## Sprint 32 — Devoluciones y notas de crédito
**Backend:**
- App `returns` con flujo: solicitud → autorización → recepción → reembolso o nota de crédito.
- Reingreso de stock automático.

**Frontend (Cliente):**
- Desde `/account/orders` botón "Solicitar devolución".
- Form con motivo y fotos.

**Frontend (Admin sucursal):**
- Página `/app/returns` para revisar solicitudes.
- Aprobar/rechazar con notas.
- Generar nota de crédito (Sprint 30).

**Entregable:** Ciclo post-venta completo.

---

# FASE F — Reportes e insights

## Sprint 33 — Reportes globales (Superadmin)
**Frontend (Superadmin):**
- Página `/app/admin/reports` con tabs:
  - **Ventas**: por sucursal, por canal, por categoría, comparativos.
  - **Inventario**: stock crítico global, productos sin movimiento, valor de inventario.
  - **Clientes**: nuevos, recurrentes, top clientes, churn.
  - **Pagos**: por método, conciliación.
- Gráficos avanzados con Chart.js (área, barras, donut, heatmap).
- Selector de rango de fechas.

**Entregable:** Visión completa del negocio.

---

## Sprint 34 — Reportes por sucursal (Admin sucursal)
**Frontend (Admin sucursal):**
- Página `/app/reports` filtrada a su sucursal.
- Ventas diarias/semanales/mensuales.
- Top SKUs.
- Comisiones de vendedores.
- Inventario crítico.

**Entregable:** Admin sucursal toma decisiones operativas.

---

## Sprint 35 — Exportación Excel y PDF
**Backend:**
- Endpoints `/api/v1/.../export/` con `format=xlsx|pdf|csv`.
- Generación con Pandas/openpyxl/ReportLab en Celery.

**Frontend:**
- Botón "Exportar" en cada reporte.
- Modal con opciones (columnas, rango).
- Notificación cuando esté listo (descarga directa).

**Entregable:** Reportes descargables.

---

## Sprint 36 — Analytics y KPIs avanzados
**Backend:**
- Vistas materializadas para KPIs en tiempo real.
- Tracking de eventos (vista de producto, add to cart, compra).

**Frontend:**
- Heatmaps de comportamiento.
- Funnel de conversión.
- Cohort de retención.

**Entregable:** Decisiones basadas en data.

---

# FASE G — Marketing y retención

## Sprint 37 — Cupones y promociones
**Backend:**
- App `coupons` ya existente.
- Reglas: porcentaje/monto fijo, mínimo compra, categorías/productos elegibles, vigencia, uso por cliente.
- Promociones automáticas (2x1, 3x2, descuento por categoría).

**Frontend (Superadmin):**
- Página `/app/admin/coupons` con CRUD.
- Estadísticas de uso.

**Frontend (Cliente):**
- Campo de cupón en checkout.

**Entregable:** Herramientas de marketing.

---

## Sprint 38 — Drops programados con countdown
**Backend:**
- Modelo `Drop` con fecha de lanzamiento, producto destacado, stock dedicado.
- Solo visible públicamente cuando llega la fecha.

**Frontend:**
- En landing, countdown del próximo drop.
- Página `/drops` con drops actuales y próximos.
- Email a interesados al lanzar.

**Entregable:** Lanzamientos esperados con hype.

---

## Sprint 39 — Notificaciones in-app y push (mobile)
**Backend:**
- App `notifications` con tipos (orden, drop, descuento, sistema).
- WebSocket para nueva orden en panel admin sucursal.
- Push notifications para app móvil (Expo).

**Frontend:**
- Bell en navbar/dashboard con contador.
- Centro de notificaciones.

**Entregable:** Comunicación en vivo.

---

## Sprint 40 — Programa de fidelización
**Backend:**
- Modelo `LoyaltyPoint` y `LoyaltyTier` (Bronce, Plata, Oro).
- Reglas: X puntos por $1 gastado.
- Canje en checkout.

**Frontend (Cliente):**
- Tab "Mis puntos" en `/account`.
- Beneficios por nivel.
- Historial de puntos.

**Entregable:** Retención de clientes.

---

# FASE H — Pulido y deploy

## Sprint 41 — Seguridad, auditoría y rate limiting
- Rate limiting en endpoints sensibles.
- Auditoría de cambios en catálogo, precios, stock, pedidos.
- 2FA opcional para admin.
- Sesiones simultáneas controladas.
- Logs estructurados (JSON).

---

## Sprint 42 — Performance y caché
- Cache de catálogo en Redis.
- Optimización de queries (select_related, prefetch_related).
- Resize automático de imágenes (Celery + responsive variants).
- Lazy loading agresivo.
- CDN para assets.

---

## Sprint 43 — Documentación
- Swagger OpenAPI completo (drf-spectacular).
- Manual de usuario superadmin.
- Manual de usuario admin de sucursal.
- Onboarding para vendedores.

---

## Sprint 44 — Deploy producción
- VPS Ubuntu 24 + Docker Compose.
- Nginx + Certbot SSL.
- Dominio + DNS.
- Backups automáticos.
- Monitoreo (Sentry).
- CI/CD básico con GitHub Actions.

---

# Recomendación: por dónde iniciar

Has terminado los Sprints 1, 2 y 3 (con detalles). El **siguiente paso lógico para construir el negocio** es la **FASE A — Sprints 4 → 10**, en este orden:

### 🎯 Orden recomendado (próximos 7 sprints)

| # | Sprint | Por qué primero |
|---|---|---|
| 1 | **Sprint 4 — Marcas** | Sin marcas no hay productos. Rápido (~1 día). |
| 2 | **Sprint 5 — Categorías** | Misma razón. Rápido (~1-2 días). |
| 3 | **Sprint 6 — Productos** | El catálogo es el corazón. Más extenso (~3-4 días). |
| 4 | **Sprint 7 — Variantes** | Sin variantes no se vende por talla. (~2 días). |
| 5 | **Sprint 8 — Sucursales + matriz** | Base operativa. (~2 días). |
| 6 | **Sprint 9 — Crear admins de sucursal** | Habilita la FASE B. (~1 día). |
| 7 | **Sprint 10 — PayPhone config** | Habilita la FASE D después. (~2 días). |

Con esos **7 sprints (~2 semanas)** tienes:
- ✅ Catálogo completo administrable
- ✅ 6 sucursales con sus admins
- ✅ PayPhone listo para integrar

### Luego, el camino al "MVP comprable"

| Sprint | Lo que habilita |
|---|---|
| 11 — Dashboard admin sucursal | Admins pueden operar |
| 12 — Inventario | Stock real por sucursal |
| 16 — Registro cliente (refinar) | Clientes pueden registrarse |
| 18 — Catálogo público (conectar UI) | Cliente ve productos reales |
| 19 — Producto detalle (conectar UI) | Cliente ve detalle real |
| 20 — Carrito | Cliente llena carrito |
| 23 — Direcciones | Para checkout |
| 24 — Checkout | Cliente paga |
| 25 — PayPhone integración | Pago real funciona |
| 27 — Emails transaccionales | Cliente recibe confirmación |
| 28 — Pedidos web en admin sucursal | Sucursal cumple pedidos |

Con esos sprints adicionales (~4-5 semanas más) tienes **Delux vendiendo en línea de extremo a extremo**.

---

## Recomendación técnica para Claude

Build with clean architecture, multi-tenant from day 1, multi-branch in domain layer. Avoid duplicated code. Reusable components, services, helpers, guards, layouts. Type-safe (no `any`). All HTTP in services. Each business rule in a `services/` module on backend. Each major view paginated and lazy loaded on frontend.
