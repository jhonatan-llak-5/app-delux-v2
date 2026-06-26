"""Verificación de reCAPTCHA v2 usando la secret key de PlatformSettings."""
import requests


def verify_recaptcha(token: str, remote_ip: str = '') -> bool:
    """True si el captcha es válido O si no hay reCAPTCHA configurado.

    Si el superadmin no configuró la secret key, no se exige captcha (no bloquea).
    """
    from apps.settings.models import PlatformSettings
    secret = (PlatformSettings.load().recaptcha_secret_key or '').strip()
    if not secret:
        return True  # reCAPTCHA no configurado -> no se exige
    if not token:
        return False
    try:
        r = requests.post(
            'https://www.google.com/recaptcha/api/siteverify',
            data={'secret': secret, 'response': token, 'remoteip': remote_ip or ''},
            timeout=10,
        )
        return bool(r.json().get('success'))
    except Exception:
        # Si Google no responde, no bloqueamos el registro.
        return True
