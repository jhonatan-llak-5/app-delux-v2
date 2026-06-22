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

ALLOWED_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB


class ProductImageUploadView(APIView):
    """POST multipart con field `image` -> { url }."""
    permission_classes = [permissions.IsAuthenticated, IsBranchManager]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get('image') or request.FILES.get('file')
        if not f:
            return Response({'detail': 'Falta el archivo (field "image").'},
                            status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(f.name)[1].lower()
        if ext not in ALLOWED_EXT:
            return Response(
                {'detail': f'Formato no permitido ({ext}). Usa JPG, PNG, WEBP, GIF o AVIF.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if f.size > MAX_BYTES:
            return Response(
                {'detail': 'La imagen supera el máximo de 8 MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subdir = 'products'
        target_dir = os.path.join(settings.MEDIA_ROOT, subdir)
        os.makedirs(target_dir, exist_ok=True)

        base = re.sub(r'[^A-Za-z0-9._-]', '_', os.path.splitext(f.name)[0])[:40]
        name = f'{base}-{uuid.uuid4().hex[:8]}{ext}'
        path = os.path.join(target_dir, name)

        with open(path, 'wb+') as dest:
            for chunk in f.chunks():
                dest.write(chunk)

        url = settings.MEDIA_URL.rstrip('/') + f'/{subdir}/{name}'
        return Response({'url': url, 'name': name}, status=status.HTTP_201_CREATED)
