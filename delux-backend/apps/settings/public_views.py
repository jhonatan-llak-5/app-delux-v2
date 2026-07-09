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
        phone = (d.get('phone') or '').strip()
        subject = (d.get('subject') or '').strip()
        message = (d.get('message') or '').strip()
        if not (name and email and phone and message):
            return Response({'detail': 'Nombre, email, teléfono y mensaje son obligatorios.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # reCAPTCHA (solo se exige si el superadmin lo configuró).
        from apps.accounts.recaptcha import verify_recaptcha
        token = d.get('recaptcha_token') or d.get('recaptcha') or ''
        ip = request.META.get('REMOTE_ADDR', '')
        if not verify_recaptcha(token, ip):
            return Response({'detail': 'Verificación reCAPTCHA fallida. Intenta de nuevo.'},
                            status=status.HTTP_400_BAD_REQUEST)

        msg = ContactMessage.objects.create(
            name=name[:120], email=email[:254], phone=phone[:30],
            subject=subject[:160], message=message,
        )

        # Notificación in-app a superadmin/admin (sin correo).
        try:
            from apps.notifications.push import push_notification, admin_recipients
            push_notification(
                type='contact_message',
                title='Nuevo mensaje de contacto',
                priority='P2',
                message=f'{name} escribió: {(subject or message)[:80]}',
                link='/app/admin/messages',
                recipients=admin_recipients(),
                meta={'contact_id': msg.id, 'email': email, 'phone': phone},
            )
        except Exception:
            pass  # el mensaje ya quedó guardado

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
