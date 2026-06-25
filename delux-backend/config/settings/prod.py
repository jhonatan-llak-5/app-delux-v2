"""Ajustes de producción — manejados por variables de entorno (.env.prod).

Por defecto funciona detrás de un proxy por HTTP (despliegue por IP:puerto).
Cuando tengas dominio + certificado TLS, pon SECURE_SSL=True en el .env para
activar cookies seguras y HSTS.
"""
import os

from .base import *  # noqa

DEBUG = False

# ── Hosts / CSRF (desde .env) ───────────────────────────────────────────────
ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]

# Respeta el proto reenviado por el/los proxy(s) que tiene delante.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Endurecimiento básico (no rompe HTTP)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# ── HTTPS: se activa solo cuando ya tienes dominio + TLS (SECURE_SSL=True) ──
def _flag(name, default='False'):
    return os.getenv(name, default).lower() in ('1', 'true', 'yes', 'on')

if _flag('SECURE_SSL'):
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = _flag('SECURE_SSL_REDIRECT', 'False')
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ── Almacenamiento de archivos ──────────────────────────────────────────────
# Usa S3 SOLO si hay credenciales; si no, filesystem local servido por nginx
# (MEDIA_ROOT/MEDIA_URL definidos en base.py).
if os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_STORAGE_BUCKET_NAME'):
    STORAGES = {
        'default': {'BACKEND': 'storages.backends.s3.S3Storage'},
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    }
    AWS_S3_FILE_OVERWRITE = False

# ── Sentry (opcional) ───────────────────────────────────────────────────────
_sentry_dsn = os.getenv('SENTRY_DSN')
if _sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=_sentry_dsn, traces_sample_rate=0.1)
    except Exception:
        pass
