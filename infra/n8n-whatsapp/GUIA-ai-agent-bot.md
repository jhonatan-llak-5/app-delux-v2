# Guía — Bot DLUX con AI Agent (memoria + búsqueda real) en n8n

Convierte el bot de "responde cada mensaje aislado" a una **conversación real** que
recuerda lo que el cliente dijo y busca productos solo cuando hace falta.

## Flujo final
```
Webhook  →  Edit Fields  →  IF (privado y no mío)  →  AI Agent  →  Evolution (enviar texto)
                                                         │
                              ┌──────────────────────────┼───────────────────────────┐
                          Chat Model (Groq)        Memory (Simple)         Tool (buscar_producto)
```

---

## PASO 1 — Borrar
Elimina estos DOS nodos (los que hacían "buscar siempre"):
- **Backend Delux API** (HTTP Request al bot/products)
- **Groq** (HTTP Request a la API de Groq)

Conserva: **Webhook, Edit Fields, IF** y el nodo de **Evolution** que envía el texto.

---

## PASO 2 — Agregar el AI Agent
1. Entre el **IF** (salida `true`) y el nodo **Evolution**, agrega el nodo **AI Agent**.
2. Configúralo:
   - **Agent:** Tools Agent (viene por defecto).
   - **Source for Prompt (User Message):** `Define below`
   - **Prompt (User Message):** `{{ $('Edit Fields').item.json.message }}`
   - **System Message:** (pega el bloque del PASO 6)

---

## PASO 3 — Chat Model (Groq)
Bajo el AI Agent haz clic en el conector **Chat Model +**:
- Elige **Groq Chat Model** (si no aparece, usa **OpenAI Chat Model** y en la
  credencial pon Base URL `https://api.groq.com/openai/v1` con tu API key de Groq).
- Crea la credencial con tu **Groq API key**.
- **Model:** `llama-3.3-70b-versatile`

---

## PASO 4 — Memory (para que recuerde)
Haz clic en el conector **Memory +**:
- Elige **Simple Memory** (Window Buffer Memory).
- **Session ID:** `Define below` → `{{ $('Edit Fields').item.json.remoteJid }}`
  (así la memoria es POR número de cliente).
- **Context Window Length:** 10

---

## PASO 5 — Tool (buscar_producto)
Haz clic en el conector **Tool +** → elige **HTTP Request** (herramienta):
- **Name:** `buscar_producto`
- **Description:** `Busca calzado en el catálogo DLUX por texto (marca, modelo o color) y opcionalmente por ciudad. Úsala cuando el cliente quiera ver o preguntar por zapatos.`
- **Method:** GET
- **URL:** `https://deluxstyle.com/api/v1/bot/products/`
- **Headers → Add:** name `X-Bot-Key`, value `TU_BOT_API_KEY`
- **Send Query Parameters:** ON, y agrega dos:
  - name `q`   → value `{{ $fromAI('q', 'texto a buscar: marca, modelo o color', 'string') }}`
  - name `city`→ value `{{ $fromAI('city', 'ciudad del cliente si la menciona', 'string') }}`

> `$fromAI(...)` deja que el modelo rellene el valor. Así el agente decide qué buscar.

---

## PASO 6 — System Message del agente
```
Eres "DLUX Asistente", vendedor de calzado urbano DLUX en Quito, Ecuador.
Hablas por WhatsApp: cálido, breve (2-4 líneas), máximo 1 emoji, tuteas.

FLUJO DE VENTA:
1. Si el cliente saluda, dale la bienvenida y pregunta qué busca (modelo, marca o
   color) y de qué ciudad escribe.
2. Cuando el cliente indique qué calzado quiere, usa la herramienta buscar_producto
   para obtener productos REALES. Nunca inventes precios, tallas ni enlaces.
3. Muestra hasta 5 resultados, uno por línea:
   • {nombre} — ${precio} → {url}
   Luego invítalo a elegir uno o a decir su talla/ciudad para confirmar stock.
4. Si no hay resultados, sugiere otras marcas/modelos y sigue ayudando.
5. Cuando muestre intención de compra o pida un asesor, dile que lo comunicas con
   un asesor humano.

Recuerda con el historial lo que el cliente ya te dijo (ciudad, gustos).
NO vuelvas a saludar si ya saludaste.

INFO: cuero sintético premium, 100% original, con garantía. Envíos a todo Ecuador
24-48h, pago contra entrega, transferencia y QR DeUna.
```

---

## PASO 7 — Conectar la salida y probar
1. Conecta la salida principal del **AI Agent** al nodo **Evolution**.
2. En el nodo **Evolution**, el texto a enviar = `{{ $json.output }}`
   (el AI Agent devuelve la respuesta en el campo `output`).
3. Guarda, pon el Webhook en **Listen for test event** y escribe por WhatsApp:
   - "Hola" → bienvenida y pregunta.
   - "Quito" → recuerda y pregunta qué modelo (¡ya no repite el saludo!).
   - "zapatos azules" → llama a buscar_producto y muestra los 5 con enlace.

---

## Notas
- Requiere el backend nuevo subido y `PUBLIC_SITE_URL=https://deluxstyle.com` en el `.env`
  (para que salga la URL de cada zapato).
- La memoria vive en n8n mientras el workflow esté activo; con "Simple Memory" se
  guarda en RAM. Para memoria persistente se usa Redis (más adelante).
