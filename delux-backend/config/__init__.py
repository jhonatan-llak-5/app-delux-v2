"""Carga la app de Celery al iniciar Django.

Sin esto, los ``@shared_task`` no quedan ligados a la app de Celery configurada
(con broker Redis) y usan el broker por defecto (amqp/RabbitMQ), por lo que
``task.delay()`` falla con "Connection refused" en el proceso web.
"""
from .celery import app as celery_app

__all__ = ('celery_app',)
