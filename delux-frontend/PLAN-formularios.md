# Plan de estandarización de formularios — Delux

## Objetivo (lo que pediste)
1. **Una sola forma de respuesta de error en todo el API** y que el front la consuma igual en todos lados.
2. **Errores de validación → se muestran en el campo** (debajo del input, con borde rojo).
3. **Solo errores de sistema → toast** (500, sin conexión, errores no asociados a un campo).
4. **Asterisco `*`** en TODOS los campos requeridos, en todos los módulos.
5. **Validación del front = validación del backend** (mismos `maxlength`, `min/max`, requeridos). Si el back limita a N, el front no deja meter más.

## Estado de la base (ya existe)
- Backend: handler unificado `common/exceptions/handlers.py` → `{ success:false, error:{ code, detail } }`. ✅ (no se cambia)
- Front: `parseApiError()` ya separa `{ fieldErrors, message }`. ✅
- **Patrón estándar** (implementado como referencia en el form de Sucursal):
  - En el modal: `fieldErrors = signal<Record<string,string>>({})`, helper `fe(k)`, y debajo de cada input `@if (fe('campo')) { <p class="text-xs text-rose-600 mt-1">…</p> }` + `[class.!border-rose-400]="fe('campo')"`.
  - Método `setErrors(parsed)` que llena `fieldErrors` y deja `message` solo para toast.
  - En el padre (la página): `const p = parseApiError(e); modal.setErrors(p); if (p.message && !campos) notify.error(p.message);`

## Corregido en este paso
- **Sucursal (Branch)**: lat/lon ampliados a `max_digits=12, decimal_places=8` (migración `0004`), el front redondea a 8 decimales antes de enviar (ya no truena con coordenadas largas). Errores por campo + toast solo de sistema. Inputs lat/lon con `min/max`. ✅

## Pendiente — módulo a módulo

### Auth (`features/auth`)
- **Login**: agregar labels con `*` (usuario, contraseña); ya usa parseApiError (mensaje genérico por seguridad, se mantiene). 
- **Registro**: ✅ ya tiene errores por campo + `*`. (referencia)
- **Recuperar / Reset / Activar**: mensajes por campo (email/código), `*` en labels.

### Cuenta (`features/account`)
- **Perfil**: migrar a parseApiError + errores por campo; `*` en nombre.
- **Direcciones (modal)**: errores por campo; `*` en línea1 y ciudad.

### Contacto (`features/contact`)
- `*` en nombre, email, mensaje; errores por campo (hoy usa solo toast).

### Checkout (`features/checkout`)
- `*` en nombre, email, teléfono y dirección de envío; errores por campo.

### Superadmin — modales (`features/superadmin/components`)
| Form | Falta |
|------|------|
| Sucursal | ✅ hecho (referencia) |
| Marca | errores por campo; `*` en nombre |
| Categoría | errores por campo (ya usa parseApiError); `*` ok |
| Cupón | errores por campo; `*` ok |
| Cliente | errores por campo; `*` ok |
| Proveedor | errores por campo; `*` en nombre |
| Ajustar stock | errores por campo; `*` en cantidad |
| Transferir stock | errores por campo; `*` en sucursal/cantidad |
| Producto manual (recepción) | errores por campo; `*` ya en nombre/marca/categoría |

### Superadmin — páginas (`features/superadmin/pages`)
- **Producto (form completo)**: errores por campo; `*` en nombre, marca, categoría, precio.
- **Staff**: errores por campo (ya usa parseApiError); `*` ok.
- **Configuración de plataforma**: errores por campo por pestaña.

## Paridad front/back (maxlength y tipos) a alinear
- Tomar `max_length`, `min/max`, requeridos de cada serializer y reflejarlos como `maxlength`, `min`, `max`, `required` en el input correspondiente (revisión campo por campo en cada serializer).

## Orden sugerido de ejecución (por impacto)
1. Superadmin modales (marca, proveedor, categoría, cupón, cliente, stock, transfer).
2. Superadmin páginas (producto, staff, settings).
3. Cuenta (perfil, direcciones) + Contacto + Checkout.
4. Auth (labels/`*` + mensajes por campo).
