"""Endpoints públicos: contacto y newsletter."""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ContactMessage, NewsletterSubscriber


class ContactCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        d = request.data
        name = (d.get('name') or '').strip()
        email = (d.get('email') or '').strip()
        message = (d.get('message') or '').strip()
        if not (name and email and message):
            return Response({'detail': 'Nombre, email y mensaje son obligatorios.'},
                            status=status.HTTP_400_BAD_REQUEST)
        ContactMessage.objects.create(
            name=name[:120], email=email[:254],
            subject=(d.get('subject') or '')[:160], message=message,
        )
        return Response({'detail': 'Mensaje enviado. Te responderemos pronto.'},
                        status=status.HTTP_201_CREATED)


class NewsletterSubscribeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email or '@' not in email:
            return Response({'detail': 'Ingresa un correo válido.'},
                            status=status.HTTP_400_BAD_REQUEST)
        obj, created = NewsletterSubscriber.objects.get_or_create(
            email=email[:254], defaults={'is_active': True},
        )
        if not created and not obj.is_active:
            obj.is_active = True
            obj.save(update_fields=['is_active'])
        return Response({'detail': '¡Suscripción confirmada! Gracias.'},
                        status=status.HTTP_201_CREATED)
