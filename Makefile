.PHONY: help up down logs test test-backend test-frontend e2e-playwright-docker e2e-playwright-docker-auth e2e-playwright-docker-jwt e2e-playwright-docker-proxy e2e-playwright-docker-all-auth lint format docs-install docs-serve docs-build

help:
	@echo "Targets:"
	@echo "  make up                     - docker compose up --build (api + web only)"
	@echo "  make down                   - docker compose down"
	@echo "  make logs                   - docker compose logs -f"
	@echo "  make test                   - run backend + frontend tests"
	@echo "  make test-backend           - run dotnet tests"
	@echo "  make test-frontend          - run frontend tests"
	@echo "  make e2e-playwright-docker         - non-auth E2E (compose + .env.testing)"
	@echo "  make e2e-playwright-docker-auth    - API-key auth E2E (.env.testing.auth)"
	@echo "  make e2e-playwright-docker-jwt     - JWT auth E2E (.env.testing.jwt)"
	@echo "  make e2e-playwright-docker-proxy   - proxy headers auth E2E (.env.testing.proxy)"
	@echo "  make e2e-playwright-docker-all-auth - api-key + jwt + proxy sequentially"
	@echo "  make lint          - best-effort lint (if configured)"
	@echo "  make docs-install  - install docs deps (venv required)"
	@echo "  make docs-serve    - serve docs locally"
	@echo "  make docs-build    - build docs (strict)"

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	$(MAKE) test-backend
	$(MAKE) test-frontend

test-backend:
	dotnet test PostgresQueryAutopsyTool.sln --configuration Release

test-frontend:
	cd src/frontend/web && npm test

e2e-playwright-docker:
	./scripts/e2e-playwright-docker.sh

e2e-playwright-docker-auth:
	./scripts/e2e-playwright-docker.sh --auth

e2e-playwright-docker-jwt:
	./scripts/e2e-playwright-docker.sh --jwt

e2e-playwright-docker-proxy:
	./scripts/e2e-playwright-docker.sh --proxy

e2e-playwright-docker-all-auth:
	./scripts/e2e-playwright-docker.sh --all-auth

lint:
	@echo "Lint target is best-effort; run CI for canonical checks."

format:
	@echo "Formatting is best-effort; run dotnet format / prettier if you add it."

docs-install:
	pip install -r requirements-docs.txt

docs-serve:
	mkdocs serve

docs-build:
	mkdocs build --strict

