.PHONY: help up down logs test test-backend test-frontend lint format docs-install docs-serve docs-build

help:
	@echo "Targets:"
	@echo "  make up            - docker compose up --build"
	@echo "  make down         - docker compose down"
	@echo "  make logs          - docker compose logs -f"
	@echo "  make test          - run backend + frontend tests"
	@echo "  make test-backend - run dotnet tests"
	@echo "  make test-frontend- run frontend tests"
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

