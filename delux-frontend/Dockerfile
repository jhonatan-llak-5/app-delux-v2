# ============================================================================
# Delux frontend — build de producción (Angular) servido por nginx
# Multi-stage: 1) compila el SPA  2) lo sirve nginx + proxy al backend
# ============================================================================

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependencias con el lockfile (reproducible)
COPY package*.json ./
RUN npm ci

# Copia el código y compila en modo producción
COPY . .
RUN npx ng build --configuration production

# ---- Stage 2: runtime (nginx) ----
FROM nginx:alpine

# Config propia (SPA + proxy /api, /admin, /ws, /static, /media)
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.prod.conf /etc/nginx/conf.d/delux.conf

# Artefactos compilados (Angular application builder -> dist/<proj>/browser)
COPY --from=build /app/dist/delux-frontend/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
