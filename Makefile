.PHONY: help up down logs test test-backend test-frontend lint format

help:
	@echo "Targets:"
	@echo "  make up            - docker compose up --build"
	@echo "  make down         - docker compose down"
	@echo "  make logs          - docker compose logs -f"
	@echo "  make test          - run backend + frontend tests"
	@echo "  make test-backend - run dotnet tests"
	@echo "  make test-frontend- run frontend tests"
	@echo "  make lint          - best-effort lint (if configured)"

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

