# Delux — Atajos de docker compose

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f backend celery

shell-backend:
	docker compose exec backend bash

shell-django:
	docker compose exec backend python manage.py shell

migrate:
	docker compose exec backend python manage.py makemigrations
	docker compose exec backend python manage.py migrate

seed:
	docker compose exec backend python manage.py seed_delux

reset:
	docker compose down -v
	docker compose up -d --build
	@sleep 6
	$(MAKE) migrate
	$(MAKE) seed

restart-celery:
	docker compose restart celery celery-beat

clean-pyc:
	docker compose exec backend find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
