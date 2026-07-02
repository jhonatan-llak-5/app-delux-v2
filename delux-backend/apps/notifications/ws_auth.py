"""Middleware de autenticación JWT para WebSockets.

Los navegadores no permiten cabeceras personalizadas en WebSocket, así que el
token de acceso viaja por query string: ws(s)://host/ws/...?token=<access>.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_token(token: str):
    from rest_framework_simplejwt.tokens import AccessToken
    from django.contrib.auth import get_user_model
    try:
        data = AccessToken(token)
        User = get_user_model()
        return User.objects.get(id=data['user_id'], is_active=True)
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        qs = parse_qs((scope.get('query_string') or b'').decode())
        token = (qs.get('token') or [None])[0]
        if token:
            scope['user'] = await _user_from_token(token)
        elif 'user' not in scope:
            scope['user'] = AnonymousUser()
        return await super().__call__(scope, receive, send)
