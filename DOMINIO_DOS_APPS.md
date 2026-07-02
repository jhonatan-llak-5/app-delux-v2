# Dos apps en el mismo VPS: **staging** y **producción**

Esquema de dominios:

| App | Carpeta | APP_ENV | WEB_PORT | Dominio |
|-----|---------|---------|----------|---------|
| **Staging** (pruebas) | `/var/www/delux_v2/staging` | `staging` | `8080` | `staging.deluxstyle.com` |
| **Producción** | `/var/www/delux_v2/prod` | `prod` | `8081` | `deluxstyle.com` + `www` |

Cada app está **totalmente aislada**: el `docker-compose.prod.yml` usa
`name: delux_${APP_ENV}`, así que contenedores, red y **volúmenes de Postgres**
son distintos → **bases de datos separadas**. El nginx del host enruta cada
dominio a su puerto.

> IP del VPS en esta guía: `31.220.94.177`.

---

## Paso 0 — DNS en Namecheap (Advanced DNS)

Ya tienes `@` y `www` (para producción). **Agrega uno más para staging**:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `@` | `31.220.94.177` | Automatic | ← (ya lo tienes) prod |
| A | `www` | `31.220.94.177` | Automatic | ← (ya lo tienes) prod |
| A | `staging` | `31.220.94.177` | Automatic | ← **nuevo**, staging |

Verifica: `nslookup staging.deluxstyle.com` debe devolver `31.220.94.177`.

---

## Paso 1 — Instalar nginx + certbot y el snippet compartido (una sola vez)

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot

# Snippet compartido de WebSocket (lo usan staging y prod).
sudo cp /var/www/delux_v2/staging/deploy/nginx/websocket-upgrade.conf \
        /etc/nginx/conf.d/websocket-upgrade.conf

sudo ufw allow 80,443/tcp   # si usas UFW
```

---

## Paso 2 — Levantar la app STAGING (puerto 8080)

En `/var/www/delux_v2/staging/.env` asegúrate de:

```ini
APP_ENV=staging
WEB_PORT=8080
DB_NAME=delux_staging          # base de datos propia de staging
ALLOWED_HOSTS=staging.deluxstyle.com,31.220.94.177,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://staging.deluxstyle.com
SECURE_SSL=True
SECURE_SSL_REDIRECT=False
FRONTEND_URL=https://staging.deluxstyle.com
CORS_ALLOWED_ORIGINS=https://staging.deluxstyle.com
```

Levanta el stack:

```bash
cd /var/www/delux_v2/staging
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Paso 3 — Certificado + nginx de STAGING

**3.1 Config bootstrap (solo HTTP) para validar el dominio:**

```bash
cd /var/www/delux_v2/staging
sudo cp deploy/nginx/staging.deluxstyle.com.bootstrap.conf \
        /etc/nginx/sites-available/staging.deluxstyle.com.conf
sudo ln -sf /etc/nginx/sites-available/staging.deluxstyle.com.conf \
            /etc/nginx/sites-enabled/staging.deluxstyle.com.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Prueba: `http://staging.deluxstyle.com` debe abrir la app (sin candado aún).

**3.2 Emitir el certificado:**

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d staging.deluxstyle.com \
  --email tu-correo@deluxstyle.com --agree-tos --no-eff-email
```

**3.3 Config final (HTTPS) y recarga:**

```bash
sudo cp deploy/nginx/staging.deluxstyle.com.conf \
        /etc/nginx/sites-available/staging.deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

Ya debe funcionar `https://staging.deluxstyle.com` con candado 🔒.
(Si ajustaste el `.env` en el paso 2 después de levantar, recrea el backend:
`docker compose -f docker-compose.prod.yml up -d backend websocket celery celery-beat`.)

---

## Paso 4 — PRODUCCIÓN (cuando quieras, misma mecánica en el puerto 8081)

```bash
# Clonar en su propia carpeta
sudo mkdir -p /var/www/delux_v2 && cd /var/www/delux_v2
git clone <URL_DEL_REPO> prod && cd prod
cp .env.prod.example .env
nano .env
```

En ese `.env` de producción:

```ini
APP_ENV=prod
WEB_PORT=8081
DB_NAME=delux_prod             # base de datos propia de producción
ALLOWED_HOSTS=deluxstyle.com,www.deluxstyle.com,31.220.94.177,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://deluxstyle.com,https://www.deluxstyle.com
SECURE_SSL=True
SECURE_SSL_REDIRECT=False
FRONTEND_URL=https://deluxstyle.com
CORS_ALLOWED_ORIGINS=https://deluxstyle.com
```

Levanta y configura nginx igual que staging, pero con los archivos de prod:

```bash
cd /var/www/delux_v2/prod
docker compose -f docker-compose.prod.yml up -d --build

# bootstrap -> cert -> final
sudo cp deploy/nginx/deluxstyle.com.bootstrap.conf /etc/nginx/sites-available/deluxstyle.com.conf
sudo ln -sf /etc/nginx/sites-available/deluxstyle.com.conf /etc/nginx/sites-enabled/deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot \
  -d deluxstyle.com -d www.deluxstyle.com \
  --email tu-correo@deluxstyle.com --agree-tos --no-eff-email

sudo cp deploy/nginx/deluxstyle.com.conf /etc/nginx/sites-available/deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

---

## Renovación automática (una vez)

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | \
  sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

---

## Checklist

- [ ] `nslookup staging.deluxstyle.com` → `31.220.94.177`.
- [ ] `https://staging.deluxstyle.com` abre con candado.
- [ ] Los contenedores de staging son `delux_*_staging` y publican el 8080.
- [ ] (Prod) `delux_*_prod` publican el 8081, base `delux_prod` distinta de `delux_staging`.
- [ ] En la consola del navegador: WebSocket conecta como `wss://` sin "mixed content".

## Notas importantes

- **No pongas el mismo `WEB_PORT` en las dos apps** (staging 8080, prod 8081) —
  chocarían al publicar el puerto.
- **`DB_NAME` distinto** por app garantiza datos separados (además del volumen
  aislado por `APP_ENV`).
- El **snippet `websocket-upgrade.conf`** debe estar en `conf.d/` **una sola
  vez**; los dos sitios lo comparten (no lo dupliques dentro de cada server).
