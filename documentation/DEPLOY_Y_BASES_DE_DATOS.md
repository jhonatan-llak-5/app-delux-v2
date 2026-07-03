# Delux — Despliegue automático + Acceso a las bases de datos

Guía operativa del día a día en el VPS (`31.220.94.177`).

## Entornos

| | **Staging** | **Producción** |
|---|---|---|
| Rama Git | `staging` | `production` |
| Carpeta | `/var/www/delux_v2/staging` | `/var/www/delux_v2/prod` |
| `APP_ENV` | `staging` | `prod` |
| Puerto web | `8080` | `8081` |
| Dominio | `staging.deluxstyle.com` | `deluxstyle.com` + `www` |
| Base de datos | `delux_v2_db`* | `delux_prod` |
| Contenedores | `delux_*_staging` | `delux_*_prod` |
| Contenedor Postgres | `delux_postgres_staging` | `delux_postgres_prod` |

\* Es el `DB_NAME` que tienes hoy en el `.env` de staging. Lo importante es que
**staging y prod usen `DB_NAME` distintos** para no compartir datos.

Todo lo maneja el **mismo `docker-compose.prod.yml`**; lo que cambia es el `.env`
de cada carpeta (sobre todo `APP_ENV`, `WEB_PORT` y `DB_NAME`).

---

# PARTE 1 — Despliegue automático (Jenkins)

## Cómo funciona el día a día

- **`git push` a la rama `staging`** → Jenkins despliega **staging** (8080).
- **`git push` a la rama `production`** → Jenkins despliega **producción** (8081).
- Cada deploy **reconstruye con `--build`** (frontend + backend) y aplica
  migraciones automáticamente (el contenedor backend corre `migrate` al arrancar).

Flujo típico:
```bash
# desde tu máquina
git checkout staging && git merge master   # o trabaja directo en staging
git push                                    # -> se despliega staging solo

# cuando esté probado, a producción:
git checkout production && git merge staging
git push                                    # -> se despliega producción solo
```

Jenkins está en **https://ci.deluxstyle.com**. Ahí puedes ver los logs de cada
deploy o lanzar uno manual con **Build Now**.

## Deploy manual (sin Jenkins)

Si necesitas desplegar a mano desde el servidor (mismo resultado que Jenkins):
```bash
bash /var/www/delux_v2/staging/deploy/deploy.sh staging
# o
bash /var/www/delux_v2/prod/deploy/deploy.sh production
```

O directo con compose (lo esencial: **siempre `--build`**):
```bash
cd /var/www/delux_v2/staging
docker compose -f docker-compose.prod.yml up -d --build \
  backend websocket celery celery-beat web
```

> **Importante:** después de un deploy con cambios de frontend, haz
> **Ctrl + Shift + R** en el navegador para saltarte la caché.

## Instalación de Jenkins (una sola vez)

El detalle completo (instalar Jenkins en el puerto 8082, permisos de docker,
DNS + nginx + certificado de `ci.deluxstyle.com`, job Multibranch y webhook de
GitHub) está en **`JENKINS_SETUP.md`**. Resumen de los pasos:

1. Crear las ramas `staging` y `production` en GitHub (desde `master`).
2. Instalar Jenkins en el VPS, puerto **8082**.
3. `jenkins` al grupo `docker` + dueño de `/var/www/delux_v2`.
4. DNS `ci` → IP, y nginx + certbot para `ci.deluxstyle.com`.
5. Crear el job **Multibranch Pipeline** apuntando al repo (usa el `Jenkinsfile`).
6. Webhook en GitHub → `https://ci.deluxstyle.com/github-webhook/`.

---

# PARTE 2 — Conectarte a las bases de datos

Las bases (Postgres) corren **dentro de contenedores** y **no están expuestas a
internet** (más seguro). Hay dos formas de entrar: por consola en el servidor, o
con un cliente gráfico por túnel SSH.

Datos de conexión (usuario y contraseña salen del `.env` de cada carpeta):
- Usuario: `DB_USER` (hoy `delux`)
- Contraseña: `DB_PASSWORD` (la de tu `.env`)
- Base: `DB_NAME` → staging `delux_v2_db`, prod `delux_prod`

## Opción A — Consola `psql` en el servidor (rápida, sin instalar nada)

**Staging:**
```bash
cd /var/www/delux_v2/staging
docker compose -f docker-compose.prod.yml exec postgres psql -U delux -d delux_v2_db
```

**Producción:**
```bash
cd /var/www/delux_v2/prod
docker compose -f docker-compose.prod.yml exec postgres psql -U delux -d delux_prod
```

Dentro de `psql`: `\dt` (tablas), `\du` (usuarios), `\q` (salir).

Consulta rápida de una línea (sin entrar al shell):
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U delux -d delux_v2_db -c "SELECT count(*) FROM auth_user;"
```

## Opción B — Cliente gráfico (DBeaver / pgAdmin) por túnel SSH

Como Postgres no está publicado, primero lo exponemos **solo en localhost del
VPS** (seguro) con el override incluido, y luego haces un túnel SSH.

**1) En el servidor, expón la base del entorno que quieras:**
```bash
# STAGING (puerto local 5433 en el VPS)
cd /var/www/delux_v2/staging
DB_HOST_PORT=5433 docker compose -f docker-compose.prod.yml -f docker-compose.dbexpose.yml up -d postgres

# PRODUCCIÓN (puerto local 5434 en el VPS)
cd /var/www/delux_v2/prod
DB_HOST_PORT=5434 docker compose -f docker-compose.prod.yml -f docker-compose.dbexpose.yml up -d postgres
```

**2) Desde tu PC, abre un túnel SSH** (deja esta terminal abierta):
```bash
# staging
ssh -N -L 5433:127.0.0.1:5433 jhonatan@31.220.94.177
# prod (en otra terminal)
ssh -N -L 5434:127.0.0.1:5434 jhonatan@31.220.94.177
```

**3) En DBeaver / pgAdmin, crea una conexión PostgreSQL:**
- Host: `localhost`
- Puerto: `5433` (staging) o `5434` (prod)
- Base de datos: `delux_v2_db` (staging) o `delux_prod` (prod)
- Usuario: `delux`
- Contraseña: la de tu `.env`

> DBeaver también puede hacer el túnel por ti (pestaña **SSH** de la conexión):
> host `31.220.94.177`, tu usuario/clave SSH, y en la pestaña principal pones
> Host `127.0.0.1` y el puerto (5433/5434). Así te evitas el `ssh -L` manual.

**4) Para dejar de exponer la base** (opcional, cuando termines):
```bash
cd /var/www/delux_v2/staging
docker compose -f docker-compose.prod.yml up -d postgres   # sin el override
```

## Respaldos (backup / restore)

**Backup:**
```bash
cd /var/www/delux_v2/staging
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U delux delux_v2_db > backup_staging_$(date +%F).sql
```

**Restore:**
```bash
cat backup_staging_2026-07-02.sql | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U delux -d delux_v2_db
```

---

## Notas de seguridad

- **Nunca** publiques Postgres en `0.0.0.0` (internet). El override usa
  `127.0.0.1`, así que solo se accede desde el propio VPS o por túnel SSH.
- No compartas el `.env` (tiene `SECRET_KEY`, `DB_PASSWORD`, etc.). Está en
  `.gitignore` y no se sube al repo.
- staging y prod tienen **bases separadas**: un cambio o borrado en staging
  **no** afecta producción.
