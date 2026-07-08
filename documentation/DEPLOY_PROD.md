# Despliegue a producción — deluxstyle.com

Guía paso a paso para dejar Delux corriendo en el VPS con base limpia, HTTPS y el
seed mínimo (1 superadmin, tienda Delux, sucursal **Delux Valle**, gerente Pablo).

> Arquitectura: los contenedores (postgres, redis, backend, websocket, celery, web)
> son **internos**. Solo el contenedor `web` se publica en `127.0.0.1:8081`.
> El **nginx del host** termina el TLS (:443) y hace de reverse proxy hacia `:8081`.
> La base de datos es el **contenedor postgres** (no hay que crearla a mano: se crea
> sola con `DB_NAME/DB_USER/DB_PASSWORD` del `.env`).

---

## 0) Requisitos en el VPS (una vez)

- Docker + plugin `docker compose`.
- `nginx` instalado en el host.
- `certbot` instalado (`sudo apt install certbot`).
- DNS: registros **A** de `deluxstyle.com` y `www.deluxstyle.com` apuntando a la IP del VPS.
- Firewall: abre 80 y 443; **bloquea el 8081** desde fuera (solo lo usa el nginx del host).
  ```bash
  sudo ufw allow 80,443/tcp
  sudo ufw deny 8081/tcp
  ```

---

## 1) Clonar el repo (rama production)

```bash
sudo mkdir -p /var/www/delux_v2/prod
sudo chown $USER:$USER /var/www/delux_v2/prod
git clone -b production <URL_DEL_REPO> /var/www/delux_v2/prod
cd /var/www/delux_v2/prod
```

## 2) Crear y editar el `.env` de producción

```bash
cp .env.prod.example .env
nano .env
```

Cambios **obligatorios** en `.env`:

| Variable | Valor para producción |
|---|---|
| `APP_ENV` | `prod`  ← (¡no dejar `staging`!) |
| `WEB_PORT` | `8081`  ← el nginx del host proxya a este puerto |
| `SECRET_KEY` | genera una: `python3 -c "import secrets;print(secrets.token_urlsafe(50))"` |
| `JWT_SECRET_KEY` | genera otra distinta (mismo comando) |
| `DB_PASSWORD` | una clave fuerte |
| `ALLOWED_HOSTS` | `deluxstyle.com,www.deluxstyle.com,<IP_VPS>,localhost,127.0.0.1` |
| `CSRF_TRUSTED_ORIGINS` | `https://deluxstyle.com,https://www.deluxstyle.com` |
| `FRONTEND_URL` | `https://deluxstyle.com` |
| `CORS_ALLOWED_ORIGINS` | `https://deluxstyle.com` |
| `SECURE_SSL` | `True` (dejar así) |
| `SECURE_SSL_REDIRECT` | `False` (el redirect lo hace el nginx del host) |
| `DEFAULT_FROM_EMAIL` | `no-reply@deluxstyle.com` |

> **Email:** puedes dejar `EMAIL_BACKEND=...console...` por ahora. El envío real de
> correos (comprobantes, credenciales, etc.) se configura **desde el panel del
> superadmin** (Configuración → SMTP), no hace falta tocarlo en el `.env`.

## 3) Levantar los contenedores

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Esto construye frontend + backend, y arranca todo. El backend, al iniciar, corre
solo `migrate` y `collectstatic`. Verifica:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend   # deben verse las migraciones OK
```

## 4) Sembrar los datos mínimos (una sola vez)

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_prod
# atajo equivalente:  make seed-prod
```

Crea exactamente:
- **Superadmin:** `jhonatan.dev@gmail.com`
- **Tienda:** Delux
- **Sucursal:** Delux Valle (datos de ejemplo, editables desde el panel)
- **Gerente:** `pablo@gmail.com` (asignado a Delux Valle)

Sin productos ni datos de demostración: la base queda lista para cargar datos reales.

> ¿La base traía datos viejos y quieres arrancar 100% limpio? (⚠️ borra TODO):
> ```bash
> docker compose -f docker-compose.prod.yml down -v
> docker compose -f docker-compose.prod.yml up -d --build
> docker compose -f docker-compose.prod.yml exec backend python manage.py seed_prod
> ```

## 5) HTTPS con certbot (nginx del host)

**a) Config de arranque (solo HTTP, para que certbot valide el dominio):**
```bash
sudo cp deploy/nginx/deluxstyle.com.bootstrap.conf /etc/nginx/sites-available/deluxstyle.com.conf
sudo ln -sf /etc/nginx/sites-available/deluxstyle.com.conf /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

**b) Emitir el certificado (webroot):**
```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d deluxstyle.com -d www.deluxstyle.com \
  --email jhonatan.dev@gmail.com --agree-tos --no-eff-email
```

**c) Cambiar a la config definitiva (HTTP→HTTPS + TLS + WebSocket):**
```bash
sudo cp deploy/nginx/deluxstyle.com.conf /etc/nginx/sites-available/deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

**d) Renovación automática (certbot ya instala un timer; pruébalo):**
```bash
sudo certbot renew --dry-run
# Que nginx recargue al renovar:
echo "deploy-hook = systemctl reload nginx" | sudo tee -a /etc/letsencrypt/cli.ini
```

## 6) Verificar

- Abre `https://deluxstyle.com` → debe cargar la tienda con candado válido.
- Entra al panel con `jhonatan.dev@gmail.com` y configura desde el superadmin:
  branding (logo/colores), IVA, config de pagos (banco / DE UNA) y SMTP.

---

## Actualizaciones / redeploys

```bash
bash deploy/deploy.sh production
```
Hace `git pull` de la rama `production` y reconstruye los contenedores.

## Respaldos de la base

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U delux delux > backup_$(date +%F).sql
```
