"""Limpieza MANUAL y segura de imágenes de producto huérfanas.

Un archivo se considera huérfano cuando está en MEDIA_ROOT/products/ (o su
subcarpeta thumbs/) y NO está referenciado por ningún registro de la base de
datos: ProductImage.url, ProductImage.thumb_url ni Product.main_image_url.

Diseñado para ejecutarse a mano en el servidor cuando quieras, con máxima
seguridad:

  • Por defecto es DRY-RUN: solo muestra lo que borraría, NO borra nada.
  • Solo considera archivos con más de N días de antigüedad (--older-than,
    por defecto 7) para no tocar imágenes recién subidas o en borradores en
    curso (que aún no se han confirmado).
  • Solo toca la carpeta products/ (y products/thumbs/). No mira otras carpetas.
  • Nunca borra un archivo que esté referenciado en la base de datos.

Uso:
  # Ver qué se borraría (no borra nada):
  python manage.py clean_orphan_images
  # Borrar de verdad (solo archivos con más de 7 días sin usar):
  python manage.py clean_orphan_images --apply
  # Cambiar el umbral de antigüedad (p. ej. 30 días):
  python manage.py clean_orphan_images --apply --older-than 30
"""
import os
import time

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = ('Elimina imágenes de producto huérfanas (no asociadas a ningún '
            'registro). Por defecto solo muestra; usa --apply para borrar.')

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply', action='store_true',
            help='Borra los archivos de verdad. Sin esta bandera solo muestra (dry-run).')
        parser.add_argument(
            '--older-than', type=int, default=7,
            help='Solo considera archivos con más de N días de antigüedad. '
                 'Protege subidas recientes o borradores en curso. Default: 7.')

    def handle(self, *args, **opts):
        apply = opts['apply']
        days = max(0, int(opts['older_than']))
        cutoff = time.time() - days * 86400

        media_root = str(settings.MEDIA_ROOT)
        media_url = (settings.MEDIA_URL or '/media/').rstrip('/')
        products_dir = os.path.join(media_root, 'products')

        if not os.path.isdir(products_dir):
            self.stdout.write('No existe la carpeta de imágenes (media/products/). Nada que limpiar.')
            return

        # ── 1) Conjunto de rutas referenciadas en la base de datos ──
        from apps.products.models import Product, ProductImage
        referenced_urls = set()
        for u in ProductImage.objects.values_list('url', flat=True):
            if u:
                referenced_urls.add(u)
        for u in ProductImage.objects.values_list('thumb_url', flat=True):
            if u:
                referenced_urls.add(u)
        for u in Product.objects.exclude(main_image_url='').values_list('main_image_url', flat=True):
            if u:
                referenced_urls.add(u)

        def url_to_path(u):
            """Convierte una URL local (bajo MEDIA_URL) en su ruta de archivo."""
            u = (u or '').split('?')[0].split('#')[0]
            if media_url and u.startswith(media_url):
                rel = u[len(media_url):].lstrip('/')
                return os.path.normpath(os.path.join(media_root, rel))
            return None

        referenced_paths = {p for p in (url_to_path(u) for u in referenced_urls) if p}
        self.stdout.write(f'Referencias en la BD: {len(referenced_paths)} archivo(s) en uso.')

        # ── 2) Recorre products/ (incluye thumbs/) y detecta huérfanos ──
        orphans, protected_recent = [], 0
        for root, _dirs, files in os.walk(products_dir):
            for fn in files:
                fp = os.path.normpath(os.path.join(root, fn))
                if fp in referenced_paths:
                    continue  # está en uso: nunca se toca
                try:
                    if os.path.getmtime(fp) > cutoff:
                        protected_recent += 1
                        continue  # muy reciente: se protege
                except OSError:
                    continue
                orphans.append(fp)

        # ── 3) Muestra / borra ──
        total, freed = 0, 0
        for fp in orphans:
            try:
                sz = os.path.getsize(fp)
            except OSError:
                sz = 0
            prefix = 'BORRADO   ' if apply else 'HUÉRFANO  '
            self.stdout.write(f'{prefix}{fp}')
            if apply:
                try:
                    os.remove(fp)
                    total += 1
                    freed += sz
                except OSError as e:
                    self.stderr.write(f'  ⚠ no se pudo borrar: {e}')
            else:
                total += 1
                freed += sz

        mb = freed / 1024 / 1024
        if protected_recent:
            self.stdout.write(f'Protegidos por ser recientes (< {days} día[s]): {protected_recent}.')
        if apply:
            self.stdout.write(self.style.SUCCESS(
                f'✔ {total} archivo(s) huérfano(s) borrado(s) · {mb:.2f} MB liberados.'))
        else:
            self.stdout.write(self.style.WARNING(
                f'{total} archivo(s) huérfano(s) encontrados · {mb:.2f} MB. '
                'NADA se borró (dry-run).'))
            if total:
                self.stdout.write('Para borrarlos de verdad: '
                                  'python manage.py clean_orphan_images --apply')
