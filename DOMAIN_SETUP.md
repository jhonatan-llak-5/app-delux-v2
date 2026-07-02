# Configurar dominio **deluxstyle.com** + HTTPS (Let's Encrypt)

Guía para pasar la app de acceso por IP (`http://IP:8080`) a
`https://deluxstyle.com`, con `www.deluxstyle.com` redirigiendo al principal.

**Arquitectura elegida:** nginx del **host** (VPS) en los puertos 80/443
termina el TLS y reenvía todo al contenedor `web` (que sigue en `127.0.0.1:8080`).
No hay que recompilar el frontend: usa rutas relativas y el WebSocket se adapta
solo a `wss://`.

Archivos que acompañan esta guía (en `deploy/nginx/`):
- `deluxstyle.com.bootstrap.conf` — config temporal solo-HTTP para emitir el cert.
- `deluxstyle.com.conf` — config final con HTTPS.

> Reemplaza `TU_IP_DEL_VPS` por la IP pública real y `tu-correo@...` por un correo válido.

---

## Paso 1 — DNS (en tu proveedor del dominio)

Crea dos registros **A** apuntando a la IP pública del VPS:

| Tipo | Nombre | Valor            |
|------|--------|------------------|
| A    | `@`    | `TU_IP_DEL_VPS`  |
| A    | `www`  | `TU_IP_DEL_VPS`  |

Espera a que propague (suele ser minutos; a veces hasta 24–48 h). Verifica:

```bash
dig +short deluxstyle.com
dig +short www.deluxstyle.com
# Ambos deben devolver la IP del VPS.
```

No sigas al paso 3 hasta que el DNS resuelva a tu IP (si no, certbot fallará).

---

## Paso 2 — Instalar nginx y certbot en el HOST

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

> El contenedor `web` publica el puerto **8080** en el host. El nginx del host
> tomará el **80** y **443**. No chocan.

---

## Paso 3 — Config temporal (bootstrap) y emisión del certificado

Copia la config de arranque (solo HTTP), habilítala y recarga:

```bash
# Desde la carpeta del proyecto en el VPS:
sudo cp deploy/nginx/deluxstyle.com.bootstrap.conf /etc/nginx/sites-available/deluxstyle.com.conf
sudo ln -sf /etc/nginx/sites-available/deluxstyle.com.conf /etc/nginx/sites-enabled/deluxstyle.com.conf

# (opcional) quita el sitio por defecto para que no interfiera:
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
```

Comprueba que responde por HTTP: `http://deluxstyle.com` debe abrir la app.

Emite el certificado (apex + www) con el método **webroot**:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d deluxstyle.com -d www.deluxstyle.com \
  --email tu-correo@deluxstyle.com --agree-tos --no-eff-email
```

Si todo va bien, el certificado queda en
`/etc/letsencrypt/live/deluxstyle.com/`.

---

## Paso 4 — Config final (HTTPS) y recarga

```bash
sudo cp deploy/nginx/deluxstyle.com.conf /etc/nginx/sites-available/deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

Ahora:
- `http://deluxstyle.com` → redirige a `https://deluxstyle.com`
- `https://www.deluxstyle.com` → redirige a `https://deluxstyle.com`
- `https://deluxstyle.com` → la app (con candado 🔒)

---

## Paso 5 — Ajustar variables de la app (.env) y redeploy

En el `.env` de producción del VPS (ej. `/var/www/delux_v2/staging/.env`),
deja estas líneas así (ver `.env.prod.example` como referencia):

```ini
ALLOWED_HOSTS=deluxstyle.com,www.deluxstyle.com,TU_IP_DEL_VPS,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://deluxstyle.com,https://www.deluxstyle.com
SECURE_SSL=True
SECURE_SSL_REDIRECT=False
FRONTEND_URL=https://deluxstyle.com
CORS_ALLOWED_ORIGINS=https://deluxstyle.com
```

Recrea los contenedores que leen el `.env` (backend, websocket, celery):

```bash
cd /var/www/delux_v2/staging
docker compose -f docker-compose.prod.yml up -d backend websocket celery celery-beat
```

> El frontend (`web`) **no** necesita rebuild: sirve rutas relativas.
> Solo hazlo si cambiaste código del front.

---

## Paso 6 — Renovación automática del certificado

certbot instala un timer que renueva solo. Verifica que la renovación funciona
(simulacro, sin cambiar nada real):

```bash
sudo certbot renew --dry-run
sudo systemctl list-timers | grep certbot   # debe aparecer el timer activo
```

Para que nginx recargue tras cada renovación, añade un hook (una sola vez):

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## Verificación final

- [ ] `https://deluxstyle.com` abre con candado y sin advertencias.
- [ ] `http://deluxstyle.com` y `https://www.deluxstyle.com` redirigen al canónico.
- [ ] Login funciona (JWT), y el admin de Django (`/admin/`) también.
- [ ] Notificaciones en tiempo real (WebSocket) conectan como `wss://` — revisa
      la consola del navegador: no debe haber error de "mixed content".
- [ ] Subida de imágenes de producto funciona (límite 100 MB).

## Si algo falla

- **certbot no valida** → el DNS aún no apunta al VPS, o el firewall bloquea el 80.
  Abre puertos: `sudo ufw allow 80,443/tcp`.
- **502 Bad Gateway** → el contenedor `web` no está arriba o no publica el 8080.
  `docker compose -f docker-compose.prod.yml ps` y `... logs web`.
- **CSRF/403 en el admin** → falta el dominio en `CSRF_TRUSTED_ORIGINS` (con
  `https://`) o no recreaste el `backend`.
- **Bloqueo por Host inválido (DisallowedHost)** → falta el dominio en
  `ALLOWED_HOSTS`.
