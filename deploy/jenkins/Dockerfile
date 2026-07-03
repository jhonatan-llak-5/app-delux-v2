# Jenkins + cliente de Docker (para desplegar la app via docker compose).
FROM jenkins/jenkins:lts-jdk17
USER root

# Instala el CLI de Docker y el plugin compose dentro de la imagen de Jenkins.
RUN apt-get update \
 && apt-get install -y ca-certificates curl gnupg lsb-release \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && chmod a+r /etc/apt/keyrings/docker.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y docker-ce-cli docker-compose-plugin \
 && rm -rf /var/lib/apt/lists/*

# Evita el error "dubious ownership" de git en las carpetas de deploy montadas.
RUN git config --system --add safe.directory '*'

USER jenkins
