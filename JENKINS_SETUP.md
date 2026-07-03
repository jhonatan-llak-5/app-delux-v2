# CI/CD con Jenkins — despliegues automáticos por rama

Objetivo: hacer `git push` y que se despliegue solo.

- Push a **`staging`** → despliega staging (`/var/www/delux_v2/staging`, :8080).
- Push a **`production`** → despliega producción (`/var/www/delux_v2/prod`, :8081).
- Jenkins accesible en **https://ci.deluxstyle.com** (corre en el VPS, puerto **8082**).
- Cada deploy reconstruye con **`--build`** (frontend + backend) y aplica migraciones.

Archivos que ya están en el repo:
- **`Jenkinsfile`** — el pipeline (lógica por rama).
- **`deploy/deploy.sh`** — mismo deploy, para lanzarlo a mano si hace falta.
- **`deploy/nginx/ci.deluxstyle.com.conf`** (+ bootstrap) — nginx para Jenkins.

> IP del VPS: `31.220.94.177`.

---

## Paso 0 — Crear las ramas staging y production

Tu repo hoy solo tiene `master`. Crea las dos ramas (desde master, que ya tiene el `Jenkinsfile`) y súbelas:

```bash
# en tu máquina, dentro del repo
git checkout master && git pull
git checkout -b staging && git push -u origin staging
git checkout -b production && git push -u origin production
git checkout master
```

De aquí en adelante: trabajas y mergeas a `staging` para probar, y a `production` para publicar.

---

## Paso 1 — Instalar Jenkins en el VPS (puerto 8082)

```bash
sudo apt update
sudo apt install -y fontconfig openjdk-17-jre
# Repo oficial de Jenkins
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | \
  sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/" | \
  sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update && sudo apt install -y jenkins
```

**Cambiar el puerto a 8082** (el 8080 lo usa staging):

```bash
sudo mkdir -p /etc/systemd/system/jenkins.service.d
printf '[Service]\nEnvironment="JENKINS_PORT=8082"\n' | \
  sudo tee /etc/systemd/system/jenkins.service.d/port.conf
sudo systemctl daemon-reload
sudo systemctl restart jenkins
```

Contraseña inicial (para el primer login):
```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

---

## Paso 2 — Permisos para que Jenkins pueda desplegar

Jenkins corre como el usuario `jenkins`. Necesita **Docker** y **acceso a las carpetas de deploy**:

```bash
# 1) Docker para el usuario jenkins
sudo usermod -aG docker jenkins

# 2) Que jenkins sea dueño de las carpetas de deploy (para git pull + compose)
sudo chown -R jenkins:jenkins /var/www/delux_v2

# 3) Reiniciar Jenkins para aplicar el grupo docker
sudo systemctl restart jenkins
```

> Los archivos `.env` de cada carpeta **no se tocan** (están en `.gitignore`, y
> `git reset --hard` no borra archivos ignorados). Tus datos y secretos siguen.

> Si prefieres seguir editando tú esas carpetas con tu usuario, agrégate al
> grupo jenkins: `sudo usermod -aG jenkins $USER` y vuelve a entrar por SSH.

---

## Paso 3 — DNS + nginx + certificado para ci.deluxstyle.com

**3.1 DNS (Namecheap):** agrega un registro A:

| Type | Host | Value |
|------|------|-------|
| A | `ci` | `31.220.94.177` |

Verifica: `nslookup ci.deluxstyle.com` → la IP.

**3.2 nginx bootstrap + certificado + config final:**

```bash
cd /var/www/delux_v2/staging   # el repo con los archivos deploy/nginx

sudo cp deploy/nginx/ci.deluxstyle.com.bootstrap.conf \
        /etc/nginx/sites-available/ci.deluxstyle.com.conf
sudo ln -sf /etc/nginx/sites-available/ci.deluxstyle.com.conf \
            /etc/nginx/sites-enabled/ci.deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot \
  -d ci.deluxstyle.com \
  --email TU_CORREO@ejemplo.com --agree-tos --no-eff-email

sudo cp deploy/nginx/ci.deluxstyle.com.conf \
        /etc/nginx/sites-available/ci.deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

Ya entras a Jenkins en **https://ci.deluxstyle.com** 🔒.

---

## Paso 4 — Configurar Jenkins (primer arranque)

1. Abre `https://ci.deluxstyle.com`, pega la contraseña inicial.
2. **Install suggested plugins** (trae Git, Pipeline, GitHub, etc.).
3. Crea tu usuario admin.
4. Instala también el plugin **Docker Pipeline** (Manage Jenkins → Plugins) por si acaso.

**Credenciales del repo** (si es privado en GitHub):
- Genera un **Personal Access Token** en GitHub (Settings → Developer settings → Tokens, permiso `repo`).
- En Jenkins: Manage Jenkins → Credentials → System → Global → Add Credentials
  → *Username with password*: usuario = tu usuario GitHub, password = el token.
  (Si el repo es público, sáltate esto.)

---

## Paso 5 — Crear el job Multibranch Pipeline

1. **New Item** → nombre `delux` → tipo **Multibranch Pipeline** → OK.
2. **Branch Sources** → Add source → **Git**:
   - Project Repository: `https://github.com/jhonatan-llak-5/app-delux-v2.git`
   - Credentials: la que creaste (o *none* si es público).
3. **Behaviours** → (opcional) *Filter by name (with wildcards)* → Include:
   `staging production`  ← así solo vigila esas dos ramas.
4. **Build Configuration** → Mode: *by Jenkinsfile*, Script Path: `Jenkinsfile`.
5. **Scan Multibranch Pipeline Triggers** → marca *Periodically if not otherwise run* (1 hora) como respaldo.
6. **Save**. Jenkins escanea el repo y crea un sub-job por cada rama (`staging`, `production`).

Con esto ya puedes lanzar un deploy manual con **Build Now** en cada rama.

---

## Paso 6 — Webhook de GitHub (deploy automático al hacer push)

En GitHub → repo → **Settings → Webhooks → Add webhook**:
- **Payload URL:** `https://ci.deluxstyle.com/github-webhook/`
- **Content type:** `application/json`
- **Which events:** *Just the push event*.
- Add webhook.

Desde ahora, cada `push` a `staging` o `production` **dispara el deploy solo**.

---

## Cómo desplegar (día a día)

- **Automático:** haz `git push` a la rama `staging` (o `production`) → Jenkins despliega.
- **Manual (Jenkins):** entra a `ci.deluxstyle.com` → job `delux` → rama → **Build Now**.
- **Manual (servidor, sin Jenkins):**
  ```bash
  bash /var/www/delux_v2/staging/deploy/deploy.sh staging
  ```

En todos los casos **se reconstruye con `--build`** (por eso ahora sí verás los
cambios del frontend). Recuerda el `Ctrl + Shift + R` en el navegador.

---

## Verificación / problemas comunes

- **Jenkins no puede correr docker:** ¿agregaste `jenkins` al grupo docker y
  reiniciaste Jenkins? `sudo -u jenkins docker ps` debe funcionar.
- **`permission denied` en la carpeta de deploy:** revisa `chown -R jenkins:jenkins /var/www/delux_v2`.
- **El webhook no dispara:** en GitHub → Webhooks → mira *Recent Deliveries* (debe dar 200). La URL termina en `/github-webhook/` con la barra final.
- **No cambia el frontend:** confirma que el pipeline usó `--build` (sale en el log de Jenkins) y haz hard-refresh.
- **Repo privado:** el `git fetch` del pipeline usa el remoto ya configurado en
  la carpeta de deploy; asegúrate de que ese clone tenga acceso (token en la URL
  o SSH), no solo la credencial de Jenkins.
