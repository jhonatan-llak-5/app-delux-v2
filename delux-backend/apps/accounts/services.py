"""Servicios de cuenta: generacion de codigos y envio de email."""
from __future__ import annotations

import secrets
import string
from datetime import timedelta

from django.utils import timezone

from .models import User


def generate_activation_code(length: int = 6) -> str:
    """Genera codigo numerico de 6 digitos (mas facil de leer y tipear)."""
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def assign_activation_code(user: User, ttl_minutes: int = 15) -> str:
    code = generate_activation_code()
    user.activation_code = code
    user.activation_expires_at = timezone.now() + timedelta(minutes=ttl_minutes)
    user.save(update_fields=['activation_code', 'activation_expires_at'])
    return code


def is_activation_valid(user: User, code: str) -> bool:
    if not user.activation_code or not user.activation_expires_at:
        return False
    if timezone.now() > user.activation_expires_at:
        return False
    return user.activation_code.strip() == code.strip()


def activate_user(user: User) -> None:
    user.is_email_verified = True
    user.is_active = True
    user.activation_code = ''
    user.activation_expires_at = None
    fields = ['is_email_verified', 'is_active', 'activation_code', 'activation_expires_at']
    # Afiliado: generar codigo unico al activarse (VEND0001).
    from .models import Role
    if user.role == Role.AFFILIATE and not user.ref_code:
        user.ref_code = f'VEND{user.id:04d}'
        fields.append('ref_code')
    user.save(update_fields=fields)
