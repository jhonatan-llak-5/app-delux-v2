"""Subida de imágenes de producto (una a la vez).

Acepta multipart/form-data con field `image`, valida tipo y tamaño, guarda en
MEDIA_ROOT/products/ y devuelve la URL pública para usarla en la galería.
"""
import os
import re
import uuid

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsBranchManager

DEFAULT_EXT = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'}


class ProductImageUploadView(APIView):
    """POST multipart con field `image` -> { url }."""
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get('image') or request.FILES.get('file')
        if not f:
            return Response({'detail': 'Falta el archivo (field "image").'},
                            status=status.HTTP_400_BAD_REQUEST)

        from apps.settings.models import PlatformSettings
        cfg = PlatformSettings.load()
        allowed = set(cfg.allowed_image_exts_list() or []) or DEFAULT_EXT
        max_mb = cfg.max_image_upload_mb or 5

        ext = os.path.splitext(f.name)[1].lower().lstrip('.')
        if ext not in allowed:
            return Response(
                {'detail': f'Formato no permitido (.{ext}). Permitidos: {", ".join(sorted(allowed))}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if f.size > max_mb * 1024 * 1024:
            return Response(
                {'detail': f'La imagen supera el máximo de {max_mb} MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subdir = 'products'
        target_dir = os.path.join(settings.MEDIA_ROOT, subdir)
        os.makedirs(target_dir, exist_ok=True)

        base = re.sub(r'[^A-Za-z0-9._-]', '_', os.path.splitext(f.name)[0])[:40]
        name = f'{base}-{uuid.uuid4().hex[:8]}.{ext}'
        path = os.path.join(target_dir, name)

        with open(path, 'wb+') as dest:
            for chunk in f.chunks():
                dest.write(chunk)

        url = settings.MEDIA_URL.rstrip('/') + f'/{subdir}/{name}'

        # Miniatura liviana (~500px, webp) para vistas en pequeño.
        thumb_url = url
        if ext in ('jpg', 'jpeg', 'png', 'webp'):
            try:
                from PIL import Image
                thumb_dir = os.path.join(target_dir, 'thumbs')
                os.makedirs(thumb_dir, exist_ok=True)
                thumb_name = os.path.splitext(name)[0] + '-thumb.webp'
                thumb_path = os.path.join(thumb_dir, thumb_name)
                im = Image.open(path)
                if im.mode in ('P', 'RGBA', 'LA'):
                    im = im.convert('RGB')
                im.thumbnail((500, 500))
                im.save(thumb_path, 'WEBP', quality=80, method=6)
                thumb_url = settings.MEDIA_URL.rstrip('/') + f'/{subdir}/thumbs/{thumb_name}'
            except Exception:
                thumb_url = url

        return Response(
            {'url': url, 'thumb_url': thumb_url, 'name': name},
            status=status.HTTP_201_CREATED,
        )
