# Integración DLUX ↔ NovaFactura (Facturación Electrónica SRI)

Documento de diseño. Alcance actual: **solo emisión de factura electrónica**.
Estado de NovaFactura: funcionando en **ambiente de pruebas (sandbox)**.
Ambos proyectos los administramos nosotros, pero son **dos aplicaciones y dos
bases de datos independientes**. La integración es **por API sobre HTTPS**, nunca
compartiendo base de datos.

---

## 1. Objetivo

Cuando se confirma una venta en DLUX, generar automáticamente su factura
electrónica en NovaFactura (que la firma y la envía al SRI), sin bloquear la
venta y sin perderla si la facturación falla. A futuro, cualquier otra app podrá
conectarse a NovaFactura de la misma forma (facturación como servicio).

## 2. Principios (best practices)

- **Desacople total:** DLUX es un *cliente* de la API de NovaFactura. Nada de DB
  compartida ni de sincronizar catálogos completos.
- **Asíncrono y no bloqueante:** la venta se cierra al instante; la factura se
  procesa en segundo plano (el SRI puede tardar o fallar).
- **Idempotencia:** cada venta lleva una clave única (id de la orden). Reintentar
  nunca crea facturas duplicadas.
- **Tolerante a fallos:** si la emisión falla, la venta queda con estado
  "factura pendiente/error" y botón de reintentar. La venta nunca se pierde.
- **Datos denormalizados + resolución por estándar:** DLUX envía las líneas con
  su descripción, precio, cantidad y **código de impuesto del SRI**; y el cliente
  por su **identificación (cédula/RUC)**. NovaFactura resuelve/crea lo que
  necesite. Así no dependemos de UUIDs de la otra base ni de sincronizar clientes
  ni impuestos.

## 3. Autenticación del puente (máquina-a-máquina)

NovaFactura hoy usa JWT de usuario (login humano). Para que DLUX (una máquina)
emita, se agrega auth por **API key**:

- Modelo `ApiKey` en NovaFactura, ligado a un tenant/empresa emisora.
- Se entrega **una sola vez** al crearla (se guarda **hasheada**), revocable, con
  **scope** limitado (solo emitir/consultar facturas).
- DLUX la envía en cada request: `Authorization: Api-Key <clave>`.
- Los **webhooks** de NovaFactura → DLUX se firman con **HMAC** (secreto
  compartido) para que DLUX verifique el origen.

## 4. Contrato de la API (resuelto)

Sobre `POST /api/v1/invoices/` de NovaFactura se resuelven los 3 puntos de
fricción:

1. **Cliente por identificación (no UUID):** nuevo *upsert* — DLUX envía
   `customer_identification` (cédula/RUC), `customer_name`, email, etc.;
   NovaFactura busca o crea el cliente. Consumidor Final se maneja con la
   identificación `9999999999999`.
2. **Impuesto por código SRI (no UUID):** cada línea envía el **código de
   porcentaje del SRI** (IVA 15% = `4`, 0% = `0`, exento = `7`…). NovaFactura
   resuelve su fila internamente. **No se guarda ningún mapeo de UUIDs.**
3. **Emisión en un solo paso (async):** nuevo endpoint `emit` que hace
   crear → firmar → enviar al SRI en segundo plano y responde de inmediato con el
   id de la factura y estado `PROCESANDO`. El resultado final (autorizada /
   rechazada) llega por **webhook**.

### Payload que DLUX enviará (borrador)

```
POST /api/v1/invoices/emit/
Authorization: Api-Key <clave>
Idempotency-Key: <order_id de DLUX>

{
  "company": "<uuid empresa>",           // fijo por tenant (config)
  "branch": "<uuid establecimiento>",    // fijo por tenant (config)
  "emission_point": "<uuid punto emisión>",
  "environment": "pruebas",              // o "produccion"
  "issue_date": "2026-07-28",
  "customer_identification": "1712345678",
  "customer_name": "Lucia Morales",
  "customer_email": "lucia123@gmail.com",
  "customer_address": "...",
  "payment_form": "01",                  // forma de pago SRI (efectivo, etc.)
  "payments": [{ "forma_pago": "01", "total": 40.00 }],
  "details": [
    {
      "main_code": "P00000040",
      "description": "Zapatillas Deportivas",
      "quantity": 1,
      "unit_price": 34.78,               // precio SIN IVA (o con, según se fije)
      "discount": 0,
      "iva_code": "4"                    // 15% por CÓDIGO SRI, no UUID
    }
  ]
}
```

Respuesta inmediata:

```
{ "invoice_id": "<uuid>", "status": "PROCESANDO", "access_key": null }
```

Webhook posterior (NovaFactura → DLUX):

```
POST https://dlux.../api/v1/invoicing/webhook/   (firmado HMAC)
{
  "invoice_id": "<uuid>",
  "order_ref": "<order_id de DLUX>",
  "status": "AUTORIZADA",               // o RECHAZADA / DEVUELTA
  "access_key": "2807...",
  "authorization_number": "...",
  "pdf_url": "https://.../factura.pdf",
  "xml_url": "https://.../factura.xml",
  "sri_message": ""
}
```

## 5. Datos y configuración en cada app

**NovaFactura (emisor, se configura una sola vez):**
- Empresa/RUC + certificado `.p12` + establecimiento + punto de emisión + ambiente
  pruebas. → De aquí salen los 3 UUIDs (company/branch/emission_point).
- Generar la **API key** para DLUX.

**DLUX (config del tenant, cifrada):**
- `NOVAFACTURA_BASE_URL`
- `NOVAFACTURA_API_KEY`
- `company_uuid`, `branch_uuid`, `emission_point_uuid`
- `environment` (pruebas/producción)
- Secreto HMAC para verificar webhooks.

**DLUX (en la orden/venta):** nuevos campos para el estado de facturación:
`invoice_status` (NO_EMITIDA / PROCESANDO / AUTORIZADA / RECHAZADA / ERROR),
`invoice_access_key`, `invoice_number`, `invoice_pdf_url`, `invoice_xml_url`,
`invoice_error`.

## 6. Flujo end-to-end

1. Venta confirmada en DLUX → se registra al instante.
2. Job async en DLUX arma el payload (cliente por cédula, líneas con código de
   impuesto SRI) y llama `POST /invoices/emit/` con `Idempotency-Key = order_id`.
3. NovaFactura crea+firma+envía al SRI en segundo plano; responde `PROCESANDO`.
   DLUX marca la orden `PROCESANDO`.
4. NovaFactura obtiene autorización del SRI → llama el **webhook** de DLUX.
5. DLUX guarda estado + clave de acceso + enlaces PDF/XML en la orden.
6. En **Ventas**, cada venta muestra su estado de factura, botón Ver PDF y
   Reintentar si falló.

Reintentos: mismo `Idempotency-Key` → NovaFactura devuelve la misma factura, no
duplica.

## 7. Seguridad

- HTTPS obligatorio. API key hasheada en reposo, revocable, con scope.
- Webhooks firmados con HMAC + verificación de firma en DLUX.
- Secretos (API key, cert, HMAC) fuera del repo (variables de entorno / config
  cifrada). Nunca commitear `.env`.
- Rate limiting y logs de auditoría de cada emisión.

## 8. Plan por fases

**Fase 0 — Prerrequisito (manual, en NovaFactura):**
Confirmar cuenta emisora en pruebas que emite factura manual; anotar los 3 UUIDs;
generar la API key. *(Lo hacemos nosotros en NovaFactura.)*

**Fase 1 — NovaFactura (base del puente):**
1. Auth por API key (modelo + authentication class + scope).
2. Upsert de cliente por identificación.
3. Aceptar impuesto por **código SRI** en las líneas.
4. Endpoint `emit` async (crear+firmar+enviar) + emisión de webhook de estado.

**Fase 2 — DLUX (config + emisión):**
5. Config del puente en el tenant (URL, API key, UUIDs, HMAC).
6. Servicio cliente HTTP + campos de facturación en la orden.
7. Al confirmar venta → job async → emitir (idempotente) → guardar referencia.

**Fase 3 — DLUX (estado + UI):**
8. Endpoint webhook (verifica HMAC) que actualiza la orden.
9. UI en Ventas: estado de factura, ver PDF/XML, reintentar.

**Fase 4 — Pruebas end-to-end en sandbox** con una tienda piloto y RUCs de prueba.

## 9. ¿Desde dónde empezamos?

Por **NovaFactura, Fase 1**, porque es contra lo que DLUX se va a conectar. Sin la
API key y el endpoint `emit`, DLUX no tiene destino. Orden sugerido dentro de la
Fase 1:

1. **API key** (auth de máquina). *Primer entregable.*
2. **Upsert de cliente por identificación.**
3. **Impuesto por código SRI en las líneas.**
4. **Endpoint `emit` async + webhook.**

Recién con la Fase 1 lista y probada con `curl`/Swagger, pasamos a DLUX (Fase 2).
