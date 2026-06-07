from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperadmin

from .email import send_platform_email
from .models import PlatformSettings
from .serializers import PlatformSettingsSerializer, TestEmailSerializer


class PlatformSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperadmin]

    def get(self, request):
        return Response(PlatformSettingsSerializer(PlatformSettings.load()).data)

    def patch(self, request):
        instance = PlatformSettings.load()
        ser = PlatformSettingsSerializer(instance, data=request.data, partial=True)
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
                body='Si recibes este correo, tu configuracion SMTP funciona.',
            )
        except Exception as exc:
            return Response({'detail': f'Error: {exc}'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Correo enviado.'})
