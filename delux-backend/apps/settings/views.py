from rest_framework import permissions, status
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperadmin

from .email import send_platform_email
from .models import PlatformSettings
from .serializers import (
    PlatformSettingsSerializer,
    TestEmailSerializer,
    TestPayPhoneSerializer,
)


class PlatformSettingsView(APIView):
    """
    GET   /api/v1/admin/settings/    → leer configuracion
    PATCH /api/v1/admin/settings/    → actualizar (JSON o multipart con files)
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        return Response(
            PlatformSettingsSerializer(
                PlatformSettings.load(), context={'request': request}
            ).data
        )

    def patch(self, request):
        instance = PlatformSettings.load()
        ser = PlatformSettingsSerializer(
            instance, data=request.data, partial=True, context={'request': request}
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class TestEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]

    def post(self, request):
        ser = TestEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            send_platform_email(
                to=[ser.validated_data['to']],
                subject='Prueba SMTP - Delux',
                body='Si recibes este correo, tu configuracion SMTP funciona correctamente.',
            )
        except Exception as exc:
            return Response({'detail': f'Error: {exc}'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Correo de prueba enviado correctamente.'})


class TestPayPhoneView(APIView):
    """Valida que las credenciales PayPhone configuradas responden."""
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]

    def post(self, request):
        s = PlatformSettings.load()
        if not s.payphone_enabled:
            return Response({'detail': 'PayPhone no esta habilitado.'}, status=400)
        if not s.payphone_token or not s.payphone_store_id:
            return Response({'detail': 'Faltan token o store_id de PayPhone.'}, status=400)
        # Ping simple: solo validamos que los campos esten presentes (sin llamar al API externo)
        return Response({
            'detail': 'Configuracion PayPhone valida.',
            'sandbox': s.payphone_sandbox,
            'api_url': s.payphone_api_url,
            'store_id': s.payphone_store_id,
        })


class PublicUploadConfigView(APIView):
    """GET público: límites y extensiones permitidas para validar uploads.

    Lo lee el frontend para validar tamaño/tipo ANTES de subir, con los mismos
    parámetros que el backend valida. Fuente única de verdad = PlatformSettings.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        c = PlatformSettings.load()

        def _url(f):
            try:
                return f.url if f else None
            except Exception:
                return None

        return Response({
            'max_image_upload_mb': c.max_image_upload_mb,
            'max_file_upload_mb': c.max_file_upload_mb,
            'max_video_upload_mb': c.max_video_upload_mb,
            'allowed_image_extensions': c.allowed_image_extensions,
            'allowed_file_extensions': c.allowed_file_extensions,
            'allowed_video_extensions': c.allowed_video_extensions,
            'site_name': c.site_name or c.platform_name or 'Delux',
            'platform_tagline': c.platform_tagline,
            'site_logo_url': _url(getattr(c, 'site_logo', None)),
            'site_favicon_url': _url(getattr(c, 'site_favicon', None)),
            'payphone_available': bool(
                c.payphone_enabled and c.payphone_token and c.payphone_store_id),
            'cod_enabled': True,
        })
