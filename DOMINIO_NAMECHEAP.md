# Poner en línea **deluxstyle.com** (Namecheap + servidor)

Guía manual, dividida en dos bloques:

- **Parte A — En Namecheap** (apuntar el dominio a tu VPS).
- **Parte B — En el servidor** (nginx + HTTPS + variables de la app).

Requisitos previos: la app ya corre en Docker en el VPS y responde por
`http://TU_IP_DEL_VPS:8080`. Necesitas: la **IP pública del VPS** y acceso SSH
como usuario con `sudo`.

> Reemplaza en todos lados `TU_IP_DEL_VPS` por la IP real y
> `tu-correo@deluxstyle.com` por un correo válido tuyo.

---

# Parte A — En Namecheap (proveedor del dominio)

El objetivo es crear dos registros **A**: `deluxstyle.com` y `www.deluxstyle.com`
apuntando a la IP del VPS.

### A.1 — Entrar a la administración del dominio
1. Inicia sesión en <https://www.namecheap.com>.
2. Menú izquierdo → **Domain List**.
3. Busca **deluxstyle.com** y pulsa **Manage** (a la derecha).

### A.2 — Asegurar que Namecheap maneja el DNS
1. En la pestaña **Domain**, baja a la sección **NAMESERVERS**.
2. Debe estar seleccionado **Namecheap BasicDNS**.
   - Si tienes "Custom DNS" (por ejemplo apuntando a Cloudflare u otro), los
     registros A NO se ponen aquí sino en ese otro proveedor. Para esta guía
     usamos **BasicDNS**.

### A.3 — Configurar los registros (Advanced DNS)
1. Abre la pestaña **Advanced DNS**.
2. En **HOST RECORDS**, primero **elimina** los registros por defecto que traen
   los dominios nuevos (icono de basurero 🗑), típicamente:
   - un **CNAME Record** con host `www` → `parkingpage.namecheap.com`
   - un **URL Redirect Record** con host `@` → `http://www.deluxstyle.com/`

   > Si no los borras, chocan con los registros A y el dominio seguirá mostrando
   > la página de "parking" de Namecheap.

3. Pulsa **ADD NEW RECORD** y crea estos dos:

   | Type       | Host | Value           | TTL       |
   |------------|------|-----------------|-----------|
   | A Record   | `@`  | `TU_IP_DEL_VPS` | Automatic |
   | A Record   | `www`| `TU_IP_DEL_VPS` | Automatic |

   - **Host `@`** = el dominio raíz (`deluxstyle.com`).
   - **Host `www`** = el subdominio `www.deluxstyle.com`.

4. Pulsa el **✓ (check verde)** de cada fila para guardar.

### A.4 — Esperar la propagación
El DNS puede tardar de unos minutos a varias horas (a veces hasta 24–48 h).
Desde tu PC o el servidor puedes ir comprobando:

```bash
nslookup deluxstyle.com
nslookup www.deluxstyle.com
```

Cuando **ambos** devuelvan `TU_IP_DEL_VPS`, sigue con la Parte B.
(No continúes antes: certbot fallará si el dominio aún no apunta al VPS.)

---

# Parte B — En el servidor (VPS)

Conéctate por SSH:

```bash
ssh usuario@TU_IP_DEL_VPS
```

### B.1 — Abrir puertos 80 y 443 (si usas UFW)
```bash
sudo ufw allow 80,443/tcp
sudo ufw status
```

### B.2 — Instalar nginx y certbot en el host
> El contenedor de la app publica el **8080**; el nginx del host usará **80/443**.
> No chocan.

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

### B.3 — Config temporal (solo HTTP) para emitir el certificado
Los archivos de nginx están en el repo, en
`/var/www/delux_v2/staging/deploy/nginx/`.

```bash
cd /var/www/delux_v2/staging

sudo cp deploy/nginx/deluxstyle.com.bootstrap.conf \
        /etc/nginx/sites-available/deluxstyle.com.conf
sudo ln -sf /etc/nginx/sites-available/deluxstyle.com.conf \
            /etc/nginx/sites-enabled/deluxstyle.com.conf

# Quita el sitio por defecto para que no interfiera:
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
```

Prueba en el navegador: `http://deluxstyle.com` debe abrir la app (aún sin
candado). Si abre, el DNS y el proxy funcionan.

### B.4 — Emitir el certificado HTTPS (Let's Encrypt)
```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d deluxstyle.com -d www.deluxstyle.com \
  --email tu-correo@deluxstyle.com --agree-tos --no-eff-email
```

Si sale **"Successfully received certificate"**, el cert queda en
`/etc/letsencrypt/live/deluxstyle.com/`.

### B.5 — Activar la config final (con HTTPS)
```bash
sudo cp deploy/nginx/deluxstyle.com.conf \
        /etc/nginx/sites-available/deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

Ahora debe funcionar:
- `http://deluxstyle.com` → redirige a `https://deluxstyle.com`
- `https://www.deluxstyle.com` → redirige a `https://deluxstyle.com`
- `https://deluxstyle.com` → la app con candado 🔒

### B.6 — Ajustar las variables de la app (.env)
```bash
cd /var/www/delux_v2/staging
nano .env
```

Deja estas líneas así:

```ini
ALLOWED_HOSTS=deluxstyle.com,www.deluxstyle.com,TU_IP_DEL_VPS,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://deluxstyle.com,https://www.deluxstyle.com
SECURE_SSL=True
SECURE_SSL_REDIRECT=False
FRONTEND_URL=https://deluxstyle.com
CORS_ALLOWED_ORIGINS=https://deluxstyle.com
```

Guarda (`Ctrl+O`, `Enter`, `Ctrl+X`) y recrea los contenedores que leen el `.env`:

```bash
docker compose -f docker-compose.prod.yml up -d backend websocket celery celery-beat
```

> El frontend (`web`) **no** necesita rebuild: usa rutas relativas y el
> WebSocket se adapta solo a `wss://`.

### B.7 — Renovación automática del certificado
```bash
sudo certbot renew --dry-run          # simulacro; no cambia nada real

# Hook para que nginx recargue tras cada renovación (una sola vez):
echo -e '#!/bin/sh\nsystemctl reload nginx' | \
  sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## Checklist final

- [ ] `nslookup deluxstyle.com` → devuelve la IP del VPS.
- [ ] `https://deluxstyle.com` abre con candado, sin advertencias.
- [ ] `http://deluxstyle.com` y `https://www.deluxstyle.com` redirigen al canónico.
- [ ] Login funciona y `/admin/` de Django también.
- [ ] En la consola del navegador no hay errores de "mixed content" ni de WebSocket.

## Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| Sigue mostrando "parking" de Namecheap | No borraste el CNAME/URL Redirect por defecto, o el DNS aún no propaga. |
| `certbot` falla en la validación | El DNS aún no apunta al VPS, o el puerto 80 está cerrado (`sudo ufw allow 80/tcp`). |
| **502 Bad Gateway** | El contenedor `web` no está arriba o no publica el 8080. Revisa `docker compose -f docker-compose.prod.yml ps` y `... logs web`. |
| **DisallowedHost** (400) | Falta el dominio en `ALLOWED_HOSTS` o no recreaste `backend`. |
| **403 CSRF** en el admin | Falta el dominio (con `https://`) en `CSRF_TRUSTED_ORIGINS`. |
| WebSocket no conecta / "mixed content" | Recarga con Ctrl+F5; confirma que entras por `https://` y que activaste la config final (B.5). |
