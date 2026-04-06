.PHONY: help up down logs test test-backend test-backend-docker test-frontend test-e2e-copy \
	e2e-playwright-docker e2e-playwright-docker-auth e2e-playwright-docker-jwt e2e-playwright-docker-proxy \
	e2e-playwright-docker-visual e2e-playwright-docker-all-auth \
	lint-workflows repo-health verify verify-docker lint format docs-install docs-serve docs-build

help:
	@echo "Targets:"
	@echo ""
	@echo "  Repo health / quick checks (Phase 74)"
	@echo "    make lint-workflows   - actionlint 1.7.7 (PATH or Docker rhysd/actionlint:1.7.7)"
	@echo "    make repo-health      - lint-workflows + frontend unit tests (fast)"
	@echo "    make verify           - lint-workflows + test-backend + test-frontend (needs .NET 8 runtime)"
	@echo "    make verify-docker    - lint-workflows + test-backend-docker + test-frontend (SDK 8 in Docker)"
	@echo "    make test-e2e-copy    - host Playwright persisted-flows only (needs api+web on :3000, .env.testing)"
	@echo ""
	@echo "  Stack"
	@echo "    make up                     - docker compose up --build (api + web only)"
	@echo "    make down                   - docker compose down"
	@echo "    make logs                   - docker compose logs -f"
	@echo ""
	@echo "  Tests"
	@echo "    make test                   - run backend + frontend tests (dotnet on PATH)"
	@echo "    make test-backend           - dotnet test PostgresQueryAutopsyTool.sln -c Release"
	@echo "    make test-backend-docker    - same unit project via mcr.microsoft.com/dotnet/sdk:8.0"
	@echo "    make test-frontend          - npm test in src/frontend/web"
	@echo ""
	@echo "  Browser E2E (Docker)"
	@echo "    make e2e-playwright-docker         - non-auth E2E (compose + .env.testing)"
	@echo "    make e2e-playwright-docker-auth    - API-key auth E2E (.env.testing.auth)"
	@echo "    make e2e-playwright-docker-jwt     - JWT auth E2E (.env.testing.jwt)"
	@echo "    make e2e-playwright-docker-proxy   - proxy headers auth E2E (.env.testing.proxy)"
	@echo "    make e2e-playwright-docker-all-auth - api-key + jwt + proxy sequentially"
	@echo ""
	@echo "  Docs"
	@echo "    make docs-install  - pip install -r requirements-docs.txt"
	@echo "    make docs-serve    - mkdocs serve"
	@echo "    make docs-build    - mkdocs build --strict"
	@echo ""
	@echo "  Other"
	@echo "    make lint          - placeholder (use lint-workflows for GHA files)"
	@echo "    make format        - placeholder"

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

lint-workflows:
	./scripts/lint-workflows.sh

repo-health: lint-workflows test-frontend
	@echo "repo-health: workflow lint + frontend tests OK. Next: make test-backend or make test-backend-docker."

verify: lint-workflows test-backend test-frontend
	@echo "verify: workflow lint + backend + frontend OK."

verify-docker: lint-workflows test-backend-docker test-frontend
	@echo "verify-docker: workflow lint + backend (Docker .NET 8) + frontend OK."

test-backend-docker:
	docker run --rm -v "$(CURDIR):/src" -w /src mcr.microsoft.com/dotnet/sdk:8.0 \
		dotnet test tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/PostgresQueryAutopsyTool.Tests.Unit.csproj -c Release

test-e2e-copy:
	cd src/frontend/web && PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:copy

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

e2e-playwright-docker-visual:
	./scripts/e2e-playwright-docker.sh --visual

e2e-playwright-docker-all-auth:
	./scripts/e2e-playwright-docker.sh --all-auth

lint:
	@echo "Use make lint-workflows for GitHub Actions workflows. Frontend: cd src/frontend/web && npm run lint"

format:
	@echo "Formatting is best-effort; run dotnet format / prettier if you add it."

docs-install:
	pip install -r requirements-docs.txt

docs-serve:
	mkdocs serve

docs-build:
	mkdocs build --strict
