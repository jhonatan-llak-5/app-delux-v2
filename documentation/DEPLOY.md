# Despliegue de Delux en el VPS (Docker — entorno STAGING)

Stack: **Angular (nginx)** + **Django/gunicorn** + **Daphne (WebSockets)** +
**Celery** + **Postgres** + **Redis**, con Docker Compose.

- Se clona en: **`/var/www/delux_v2/staging/`**
- Los contenedores llevan el sufijo del entorno (igual que nexosgym):
  `delux_frontend_staging`, `delux_backend_staging`, `delux_postgres_staging`,
  `delux_redis_staging`, `delux_websocket_staging`, `delux_celery_staging`,
  `delux_celery_beat_staging`.
- Solo se publica **un puerto** al host: `WEB_PORT` (por defecto **8080**).
  Postgres, Redis y backend quedan **internos** y no chocan con tus otras apps
  (nginx 80/81/82/84/85/86/443, gunicorn 97, postgres 5432/5433, nexosgym
  3002/3003/8002/8003).

> El sufijo lo controla la variable `APP_ENV` del archivo `.env`. Para una
> futura producción: clonas en `/var/www/delux_v2/prod/`, pones `APP_ENV=prod`
> y `WEB_PORT=<otro libre>`, y tendrás `delux_*_prod` sin tocar staging.

---

## 1. Requisitos

```bash
docker --version
docker compose version   # Compose v2
```

## 2. Clonar el proyecto

```bash
sudo mkdir -p /var/www/delux_v2
sudo chown -R $USER:$USER /var/www/delux_v2
cd /var/www/delux_v2
git clone <URL_DEL_REPO> staging
cd /var/www/delux_v2/staging
```

(En esta carpeta deben estar `docker-compose.prod.yml`, `delux-backend/`,
`delux-frontend/` y `.env.prod.example`.)

## 3. Configurar variables

```bash
cp .env.prod.example .env
nano .env
```

Mínimo a ajustar para staging:

- `APP_ENV=staging`  ·  `WEB_PORT=8080`
- `SECRET_KEY` y `JWT_SECRET_KEY` → claves largas aleatorias
  (`python3 -c "import secrets;print(secrets.token_urlsafe(50))"`)
- `DB_PASSWORD` → contraseña fuerte
- `ALLOWED_HOSTS` → la **IP pública** del VPS (luego el subdominio de staging)
- `FRONTEND_URL` y `CORS_ALLOWED_ORIGINS` → `http://TU_IP:8080`
- `SECURE_SSL=False` (mientras accedas por `http://IP:puerto`)

> `docker compose` autocarga el archivo `.env` de esta carpeta, no hace falta
> `--env-file`.

## 4. Construir y levantar

```bash
cd /var/www/delux_v2/staging
docker compose -f docker-compose.prod.yml up -d --build
```

Compila el frontend, construye el backend, corre migraciones + `collectstatic`
y arranca todo. La primera vez tarda unos minutos.

## 5. Crear el superadmin

```bash
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py createsuperuser
```

(Opcional) datos de ejemplo:

```bash
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py seed_delux
```

## 6. Probar

- App: `http://TU_IP:8080`
- Admin Django: `http://TU_IP:8080/admin/`
- API: `http://TU_IP:8080/api/v1/`

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 7. (Opcional) Subdominio + HTTPS con tu nginx del sistema

Como ya tienes nginx en el host (:80/:443), enruta un subdominio de staging
hacia el puerto 8080. Crea `/etc/nginx/sites-available/delux-staging`:

```nginx
server {
    listen 80;
    server_name staging.delux.midominio.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSockets
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    client_max_body_size 100m;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/delux-staging /etc/nginx/sites-enabled/delux-staging
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging.delux.midominio.com
```

Luego en `.env` (carpeta staging):

- `ALLOWED_HOSTS=staging.delux.midominio.com,TU_IP,localhost,127.0.0.1`
- `CSRF_TRUSTED_ORIGINS=https://staging.delux.midominio.com`
- `FRONTEND_URL=https://staging.delux.midominio.com`
- `CORS_ALLOWED_ORIGINS=https://staging.delux.midominio.com`
- `SECURE_SSL=True`

Y recrea:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Comandos útiles

```bash
cd /var/www/delux_v2/staging

# Parar / arrancar
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Actualizar tras git pull
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Backup de la base de datos
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$DB_USER" "$DB_NAME" > backup_staging_$(date +%F).sql

# Logs de un servicio
docker compose -f docker-compose.prod.yml logs --tail 80 -f backend
```

> Datos persistentes en volúmenes Docker: `backend_media` (uploads) y
> `delux_pg_data` (base de datos). Sobreviven a `down`/`up`; solo se borran con
> `down -v`.
