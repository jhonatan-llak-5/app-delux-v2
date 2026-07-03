#!/usr/bin/env bash
# ============================================================================
# Delux — Despliegue manual (mismo que hace Jenkins).
#   Uso:  bash deploy/deploy.sh staging      -> /var/www/delux_v2/staging (:8080)
#         bash deploy/deploy.sh production   -> /var/www/delux_v2/prod    (:8081)
# Reconstruye SIEMPRE con --build (frontend + backend) y recrea contenedores.
# ============================================================================
set -euo pipefail

BRANCH="${1:-}"
case "$BRANCH" in
  staging)    DIR=/var/www/delux_v2/staging ;;
  production) DIR=/var/www/delux_v2/prod ;;
  *) echo "Uso: bash deploy/deploy.sh <staging|production>"; exit 1 ;;
esac

echo ">> [$BRANCH] Actualizando código en $DIR"
cd "$DIR"
git fetch --all --prune
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

echo ">> [$BRANCH] Reconstruyendo y levantando (con --build)"
docker compose -f docker-compose.prod.yml up -d --build \
  backend websocket celery celery-beat web

echo ">> [$BRANCH] Limpiando imágenes viejas"
docker image prune -f

echo ">> [$BRANCH] Estado:"
docker compose -f docker-compose.prod.yml ps
echo ">> [$BRANCH] Listo."
