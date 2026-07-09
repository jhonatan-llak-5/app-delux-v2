"""Respaldo de la base de datos (solo superadmin).

Ejecuta `pg_dump` y devuelve un archivo .sql restaurable con el nombre
`dlux_backup_<YYYYMMDD_HHMMSS>.sql`. El respaldo se genera en un archivo
temporal para poder detectar errores ANTES de empezar a transmitir.
"""
import os
import subprocess
import tempfile
from datetime import datetime
from shutil import which

from django.conf import settings as dj_settings
from django.http import FileResponse, JsonResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperadmin


class DatabaseBackupView(APIView):
    """GET -> descarga un respaldo SQL completo de PostgreSQL."""
    permission_classes = [IsAuthenticated, IsSuperadmin]

    def get(self, request):
        db = dj_settings.DATABASES.get('default', {})
        engine = db.get('ENGINE', '')
        if 'postgresql' not in engine:
            return JsonResponse(
                {'detail': 'El respaldo SQL solo está disponible para PostgreSQL.'},
                status=400)

        if not which('pg_dump'):
            return JsonResponse(
                {'detail': 'pg_dump no está instalado en el servidor. '
                           'Agrega "postgresql-client" a la imagen del backend.'},
                status=503)

        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'dlux_backup_{ts}.sql'

        env = os.environ.copy()
        if db.get('PASSWORD'):
            env['PGPASSWORD'] = str(db['PASSWORD'])

        cmd = [
            'pg_dump',
            '-h', str(db.get('HOST') or 'localhost'),
            '-p', str(db.get('PORT') or '5432'),
            '-U', str(db.get('USER') or 'postgres'),
            '--no-owner', '--no-privileges', '--clean', '--if-exists',
            str(db.get('NAME') or ''),
        ]

        fd, path = tempfile.mkstemp(suffix='.sql', prefix='dlux_backup_')
        os.close(fd)
        try:
            with open(path, 'wb') as out:
                result = subprocess.run(
                    cmd, stdout=out, stderr=subprocess.PIPE, env=env, timeout=900)
        except subprocess.TimeoutExpired:
            self._safe_unlink(path)
            return JsonResponse({'detail': 'El respaldo tardó demasiado (timeout).'}, status=504)
        except Exception as e:  # pragma: no cover
            self._safe_unlink(path)
            return JsonResponse({'detail': f'No se pudo ejecutar pg_dump: {e}'}, status=500)

        if result.returncode != 0:
            err = (result.stderr or b'').decode('utf-8', 'ignore')[:500]
            self._safe_unlink(path)
            return JsonResponse({'detail': f'pg_dump falló: {err}'}, status=500)

        # En Linux, al eliminar el archivo tras abrirlo, el contenido sigue
        # disponible mediante el descriptor hasta que FileResponse lo cierra.
        f = open(path, 'rb')
        self._safe_unlink(path)
        resp = FileResponse(f, as_attachment=True, filename=filename,
                            content_type='application/sql')
        resp['X-Backup-Filename'] = filename
        return resp

    @staticmethod
    def _safe_unlink(path):
        try:
            os.unlink(path)
        except OSError:
            pass
