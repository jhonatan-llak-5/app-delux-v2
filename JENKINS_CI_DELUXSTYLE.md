# Jenkins CI en ci.deluxstyle.com — comandos listos (para hacerlo LUEGO)

> Estado actual: en el server **solo está staging** y despliegas **manual**.
> Este documento deja todo listo para montar Jenkins cuando termines tus
> features. Mientras tanto, usa el bloque "Deploy manual" del final.
>
> Datos ya rellenos: IP `31.220.94.177`. **Reemplaza `TU_CORREO@ejemplo.com`**
> por un correo válido antes de correr certbot.

Esquema de puertos en el VPS:
- `8080` → staging web · `8081` → producción web · **`8082` → Jenkins**

---

## 1) DNS en Namecheap

Agrega un registro A (además de los que ya tienes):

| Type | Host | Value |
|------|------|-------|
| A | `ci` | `31.220.94.177` |

Verifica antes de seguir:
```bash
nslookup ci.deluxstyle.com     # debe devolver 31.220.94.177
```

---

## 2) Instalar Jenkins (puerto 8082)

```bash
sudo apt update
sudo apt install -y fontconfig openjdk-17-jre

curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | \
  sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | \
  sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update && sudo apt install -y jenkins

# Cambiar el puerto a 8082 (el 8080 lo usa staging)
sudo mkdir -p /etc/systemd/system/jenkins.service.d
printf '[Service]\nEnvironment="JENKINS_PORT=8082"\n' | \
  sudo tee /etc/systemd/system/jenkins.service.d/port.conf
sudo systemctl daemon-reload
sudo systemctl restart jenkins

# Contraseña inicial (para el primer login)
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

---

## 3) Permisos para que Jenkins despliegue

```bash
sudo usermod -aG docker jenkins               # docker para jenkins
sudo chown -R jenkins:jenkins /var/www/delux_v2   # dueño de las carpetas de deploy
sudo systemctl restart jenkins

# (opcional) para que TU usuario también pueda editar esas carpetas:
sudo usermod -aG jenkins $USER
# (cierra y abre sesión SSH para aplicar el grupo)
```

---

## 4) nginx + certificado para ci.deluxstyle.com

```bash
cd /var/www/delux_v2/staging   # el repo con deploy/nginx

# Snippet compartido de WebSocket (si no lo copiaste aún)
sudo cp deploy/nginx/websocket-upgrade.conf /etc/nginx/conf.d/websocket-upgrade.conf

# 4.1 bootstrap (solo HTTP) para validar el dominio
sudo cp deploy/nginx/ci.deluxstyle.com.bootstrap.conf \
        /etc/nginx/sites-available/ci.deluxstyle.com.conf
sudo ln -sf /etc/nginx/sites-available/ci.deluxstyle.com.conf \
            /etc/nginx/sites-enabled/ci.deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx

# 4.2 emitir el certificado
sudo certbot certonly --webroot -w /var/www/certbot \
  -d ci.deluxstyle.com \
  --email TU_CORREO@ejemplo.com --agree-tos --no-eff-email

# 4.3 config final (HTTPS)
sudo cp deploy/nginx/ci.deluxstyle.com.conf \
        /etc/nginx/sites-available/ci.deluxstyle.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

Ya entras a **https://ci.deluxstyle.com** 🔒.

---

## 5) Configurar el job en Jenkins

1. `https://ci.deluxstyle.com` → pega la contraseña inicial → **Install suggested plugins** → crea tu admin.
2. (Repo privado) Manage Jenkins → Credentials → agrega *Username with password*:
   usuario GitHub + un **Personal Access Token** (permiso `repo`).
3. **New Item** → nombre `delux` → **Multibranch Pipeline** → OK.
   - Branch Sources → Git → `https://github.com/jhonatan-llak-5/app-delux-v2.git` (+ credencial si es privado).
   - Behaviours → *Filter by name (with wildcards)* → Include: `staging production`.
   - Build Configuration → *by Jenkinsfile*, Script Path: `Jenkinsfile`.
   - Save. Jenkins escanea y crea un job por rama.

---

## 6) Webhook de GitHub (deploy automático al hacer push)

GitHub → repo → **Settings → Webhooks → Add webhook**:
- Payload URL: `https://ci.deluxstyle.com/github-webhook/`
- Content type: `application/json`
- Events: *Just the push event* → Add webhook.

Desde ahí: `git push` a `staging` o `production` = deploy automático (con `--build`).

> Recuerda crear las ramas primero:
> ```bash
> git checkout master && git pull
> git checkout -b staging && git push -u origin staging
> git checkout -b production && git push -u origin production
> ```

---

## Mientras tanto — Deploy MANUAL (lo que usas hoy)

Cada vez que quieras subir cambios a staging (con rebuild del frontend):
```bash
cd /var/www/delux_v2/staging
git pull
docker compose -f docker-compose.prod.yml up -d --build \
  backend websocket celery celery-beat web
```
Y en el navegador: **Ctrl + Shift + R** (para saltar la caché).

> La clave del deploy manual es **`--build`**: sin eso, el frontend no se
> recompila y no ves los cambios.
