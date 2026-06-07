from rest_framework.views import exception_handler


def unified_exception_handler(exc, context):
    """Estructura de error consistente para todo el API."""
    response = exception_handler(exc, context)
    if response is None:
        return response

    payload = {
        'success': False,
        'error': {
            'code': getattr(exc, 'default_code', 'error'),
            'detail': response.data,
        },
    }
    response.data = payload
    return response
