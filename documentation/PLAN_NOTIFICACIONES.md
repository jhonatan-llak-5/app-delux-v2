# Plan — Sistema de notificaciones en tiempo real (WebSocket)

## Estado actual (lo que YA existe)

- **Backend:** app `apps/notifications/` con `consumers.py` (grupo WS
  `admin_notifications`), `broadcast.py` + `realtime.py` (helpers), y `signals.py`
  que ya emite en vivo: **nueva venta/pedido**, **nuevo usuario**, **stock bajo**.
  Canal WS servido por **daphne** (contenedor `websocket`), con Redis como
  channel layer en prod.
- **Frontend:** `WebSocketService` conecta por WS (push real, **no** `setInterval`),
  `toast-host` muestra avisos emergentes y `dlx-notifications-bell` es la campana.
- **También hay real-time** en el seguimiento de pedido (tracking del checkout).

### Lo que falta (por eso la campana dice "0 en total")
1. **Sin persistencia** → no hay modelo; las notificaciones se pierden al recargar,
   no hay historial ni estado leído/no leído por usuario.
2. **Sin enrutamiento** → grupo global único: todos ven todo, sin filtrar por
   tenant / sucursal / rol.
3. **Sin sonido** ni preferencias (silenciar, elegir tipos).
4. **Código duplicado** (`broadcast.py` vs `realtime.py`, nombres de tipo
   inconsistentes: `new_sale` vs `sale_created`).
5. El consumer **no autentica** al usuario (no sabe quién está conectado).

---

## Arquitectura objetivo (correcta)

- **Evento** (venta, stock, registro…) → se crea 1 fila `Notification` por cada
  destinatario → se hace **push por WebSocket** a los grupos de esos usuarios.
- **Al abrir la app:** la campana se hidrata con **1 llamada REST** (lista +
  no-leídas). Después, todo llega **en vivo por WS**. Marcar leído/leer-todo =
  REST. *No hay polling por intervalos.*
- **Enrutamiento:** el consumer autentica al usuario y se une a los grupos que le
  correspondan: `user_<id>`, `branch_<id>`, `tenant_<id>`, `role_<ROL>`. Cada
  tipo de evento define a quién va.
- **Sonido:** se reproduce al llegar una notificación (según prioridad), con
  toggle de silencio. Nota técnica: los navegadores exigen un gesto del usuario
  antes de poder sonar; se habilita el audio en el primer clic tras iniciar sesión.

---

## Catálogo recomendado (priorizado)

Prioridad: **P1** = operativo/urgente (con sonido fuerte), **P2** = importante
(sonido suave), **P3** = informativo (sin sonido, o resumen diario).

| # | Evento | Prioridad | ¿A quién? | Acción esperada |
|---|--------|-----------|-----------|-----------------|
| 1 | **Nueva venta POS** | P1 🔊 | Gerente + admins de su sucursal | Confirmar caja |
| 2 | **Nuevo pedido web** (contra entrega) | P1 🔊 | Sucursal destino + admins | Aceptar y preparar |
| 3 | **Stock bajo / agotado** | P1 🔊 | Gerente de la sucursal + admins | Reponer |
| 4 | **Devolución / cambio solicitado** | P2 | Gerente + admins | Gestionar |
| 5 | **Nuevo afiliado registrado** | P2 | Admins (tenant) | Revisar/aprobar |
| 6 | **Comisión de afiliado generada** | P2 | El afiliado (su panel) | Ver comisión |
| 7 | **Nuevo cliente registrado** | P3 | Admins (tenant) | CRM/marketing |
| 8 | **Nueva reseña de producto** | P2 | Admins + gerente | Moderar |
| 9 | **Nómina generada / lista para pagar** | P3 | Superadmin/admin/gerente | Pagar |
| 10 | **Nuevo empleado creado** | P3 | Admins | Informativo |
| 11 | **Suscriptor al newsletter** | P3 (resumen) | Admins | Resumen diario, no 1×1 |

> **Mi recomendación para empezar:** implementar bien **P1 (1, 2, 3)** primero —
> son las que generan acción inmediata y las que pediste (venta + sonido, stock).
> Luego P2 (afiliado, devolución, reseña, comisión) y dejar P3 para el final,
> con el newsletter como **resumen** (si llega 1 por cada suscriptor, es ruido).

---

## Fases de implementación

### Fase 1 — Cimientos: persistencia + leído/no-leído
- Modelo `Notification` (tenant, usuario_destino, sucursal, tipo, título,
  mensaje, link, meta JSON, prioridad, `is_read`, `created_at`, `read_at`).
- Servicio único `push_notification(...)` que **crea filas** para los
  destinatarios y **emite por WS** (reemplaza `broadcast.py` + `realtime.py`).
- Endpoints REST: `GET /notifications` (lista paginada), `GET
  /notifications/unread-count`, `POST /notifications/mark-read`, `POST
  /notifications/mark-all-read`.
- Campana: hidratar desde REST al cargar; historial real que sobrevive recargas.

### Fase 2 — Enrutamiento por rol / sucursal / tenant
- `asgi.py` con `AuthMiddlewareStack`; el consumer identifica al usuario y se une
  a sus grupos (`user_`, `branch_`, `tenant_`, `role_`).
- Reglas de destinatarios por tipo de evento (según la tabla de arriba).
- El afiliado recibe **solo lo suyo** (sus comisiones/pagos).

### Fase 3 — Sonido + UX
- Sonidos por prioridad (venta = "cha-ching" distinto; stock = alerta; resto =
  ping suave). Archivos de audio livianos.
- Toggle **silenciar** (persistente por usuario) y desbloqueo de audio con el
  primer gesto.
- Campana: badge de no-leídas, agrupar por día, marcar leído al abrir, link a la
  vista relacionada.

### Fase 4 — Conectar eventos del catálogo
- Cablear P1 → P2 → P3 al nuevo servicio, uno por uno, con su prioridad y
  destinatarios. Distinguir **afiliado** de **cliente** en el registro.

### Fase 5 — Preferencias y limpieza
- Preferencias por usuario: qué tipos recibir, horario de silencio.
- Auto-purga de notificaciones viejas (ej. > 60 días) y **resumen diario** para
  las ruidosas (newsletter).

---

## Decisiones que necesito de ti antes de construir

1. ¿Arrancamos por **Fase 1 + P1** (persistencia + venta/pedido/stock con sonido)
   y luego seguimos? *(recomendado)*
2. ¿El **afiliado** debe tener su propia campana (sus comisiones) o por ahora solo
   el staff interno?
3. ¿Sonido **distinto por tipo** o uno solo para todo al inicio?
4. ¿Alguna notificación que quieras **quitar o agregar** al catálogo?
