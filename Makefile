.PHONY: dev dev-api dev-frontend install docker-up docker-down deploy secrets

# Local development
dev: dev-api dev-frontend

dev-api:
	cd backend && uv run uvicorn app.main:app --reload --port 8080

dev-frontend:
	cd frontend && pnpm dev

install:
	cd backend && uv sync
	cd frontend && pnpm install

# Docker
docker-up:
	docker compose up --build

docker-down:
	docker compose down

# K8s
secrets:
	bash k8s/setup-secrets.sh

deploy:
	bash deploy.sh
