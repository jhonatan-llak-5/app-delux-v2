// ============================================================================
// Delux — Pipeline de despliegue (Multibranch)
//   rama "staging"     -> despliega a /var/www/delux_v2/staging  (APP_ENV=staging, :8080)
//   rama "production"  -> despliega a /var/www/delux_v2/prod     (APP_ENV=prod,    :8081)
// Siempre reconstruye con --build (frontend + backend) y aplica migraciones
// (el contenedor backend corre `migrate` al arrancar).
// ============================================================================
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()          // no dos deploys a la vez del mismo entorno
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {
    stage('Resolver entorno') {
      steps {
        script {
          if (env.BRANCH_NAME == 'staging') {
            env.DEPLOY_DIR = '/var/www/delux_v2/staging'
            env.DEPLOY_ENV = 'staging'
          } else if (env.BRANCH_NAME == 'production') {
            env.DEPLOY_DIR = '/var/www/delux_v2/prod'
            env.DEPLOY_ENV = 'prod'
          } else {
            echo "Rama '${env.BRANCH_NAME}' no despliega (solo staging/production)."
          }
        }
      }
    }

    stage('Deploy') {
      when { anyOf { branch 'staging'; branch 'production' } }
      steps {
        sh '''
          set -e
          echo ">> Entorno: $DEPLOY_ENV  ·  Dir: $DEPLOY_DIR  ·  Rama: $BRANCH_NAME"
          cd "$DEPLOY_DIR"

          echo ">> Actualizando código a origin/$BRANCH_NAME"
          git fetch --all --prune
          git checkout -f -B "$BRANCH_NAME" "origin/$BRANCH_NAME"
          git reset --hard "origin/$BRANCH_NAME"

          echo ">> Reconstruyendo y levantando (con --build)"
          docker compose -f docker-compose.prod.yml up -d --build \
            backend websocket celery celery-beat web

          echo ">> Limpiando imágenes huérfanas"
          docker image prune -f

          echo ">> Estado final:"
          docker compose -f docker-compose.prod.yml ps
        '''
      }
    }
  }

  post {
    success { echo "✅ Deploy de ${env.DEPLOY_ENV ?: env.BRANCH_NAME} completado." }
    failure { echo "❌ Falló el deploy de ${env.BRANCH_NAME}." }
  }
}
