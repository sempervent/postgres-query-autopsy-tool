# Contributing

## Repo layout

- `src/backend/` .NET 8 API + core analysis engine
- `src/frontend/web/` React + TypeScript UI
- `tests/backend.unit/` xUnit tests + fixtures
- `docs/` documentation source (MkDocs)

## Repo health, workflows, and .NET runtime (Phase 74)

**Workflow lint:** **`./scripts/lint-workflows.sh`** runs [**actionlint**](https://github.com/rhysd/actionlint) (binary on **PATH**, or **Docker** **`rhysd/actionlint:1.7.7`** — override with **`ACTIONLINT_DOCKER_IMAGE`** if needed). Config: **`.actionlint.yaml`**. CI runs **`.github/workflows/workflow-lint.yml`** (**`rhysd/actionlint@v1.7.7`**) when **`.github/workflows/**`** or **`.actionlint.yaml`** changes (saves runner time when workflows are untouched). **`make repo-health`** still runs lint locally on every invocation — use that before pushing workflow edits.

**Host Vitest / optional native bindings (Phase 76):** If **`npm test`** fails with **rolldown** / **“Cannot find native binding”** / missing **`@rolldown/binding-*`**, the toolchain’s optional platform binary did not install cleanly. **Supported fix:** from **`src/frontend/web`**, remove **`node_modules`** and **`package-lock.json`**, run **`npm install`** again on a [supported Node](https://github.com/npm/cli/issues/4828) (**20.x** per **`engines`** / **`.nvmrc`**), or run tests in **`node:20-alpine`** the same way **`Dockerfile`** / CI do. Avoid **Node 25+** for local dev until the stack officially supports it.

**Make shortcuts** (run from repo root; **`make help`** lists all):

| Goal | Command |
|------|---------|
| Fast sanity (lint + frontend tests) | **`make repo-health`** |
| Full local verify (lint + backend on PATH + frontend) | **`make verify`** — requires **.NET 8 runtime** for **`dotnet test`** (same as CI **`backend`** job) |
| Same as verify but backend via Docker SDK 8 | **`make verify-docker`** — use when the host only has **.NET 9/10** SDK or tests fail with “framework 8.0 not found” |
| Backend unit tests only (Docker) | **`make test-backend-docker`** |
| Copy/persisted-flow Playwright slice (host) | **`make test-e2e-copy`** — requires **`api` + `web`** on **`:3000`** with **`.env.testing`** (see [Browser E2E](#browser-e2e-playwright)); equivalent to **`npm run test:e2e:copy`** in **`src/frontend/web`** with **`PLAYWRIGHT_*`** env set |

**Analyze fixture sweep** is still **`PostgresJsonAnalyzeFixtureSweepTests`** plus **`Support/AnalyzeFixtureCorpus*`**; there is no separate CLI — run **`make test-backend-docker`** or **`dotnet test`** on the unit project to execute it.

## Node.js (frontend)

- **Supported:** Node **20.x** (matches CI and the **web** Docker build). **`src/frontend/web/.nvmrc`** is **`20`**; **`package.json`** has **`engines.node`** **`>=20 <25`**; optional **Volta** (`package.json` **`volta.node`**) and repo **`.tool-versions`** (asdf) pin **20.18.0**.
- **Avoid Node 25+** for local **`npm run build`** until the toolchain clearly supports it — optional native packages (e.g. Rolldown-related bindings) may not publish binaries for bleeding-edge Node versions.

## Development workflow

### Tests

```bash
make test
```

#### Backend (xUnit + fixtures)

- **`FixtureSqlCompanionTests`** enforces `postgres-json/*.sql` siblings and comparison-case SQL companions.
- **Phase 72–74:** **`PostgresJsonAnalyzeFixtureSweepTests`** runs **full** **`PlanAnalysisService`** over every top-level **`fixtures/postgres-json/*.json`** (discovery via **`AnalyzeFixtureCorpus`**) so new single-plan fixtures are not silently skipped. Structural expectations live in **`AnalyzeFixtureStructuralAssertions`**. Add deep assertions in focused tests when a fixture encodes a specific regression; keep the sweep **structural** (no prose golden files).

#### Frontend (Vitest + TypeScript)

- **`npm run build`** runs **`tsc -b`**, which typechecks **`src/**/*.tsx`** including **`src/test/`** (see `tsconfig.app.json`).
- **Unit tests:** **`npm test`** runs **`vitest run`** (single non-interactive pass — same as the **`frontend`** CI job). For local iteration use **`npm run test:watch`** (**`vitest`** watch mode). Avoid chaining extra **`--run`** flags; they are redundant with **`vitest run`**. **Phase 65–66:** **`src/theme/theme.test.ts`** covers resolver, persistence, **`data-effective-theme`**, **`prefers-color-scheme`** subscription, optional server hydrate/save (mocked **`fetchUserPreference`** / **`saveUserPreference`**); the hook tolerates missing **`window.matchMedia`**.
- **Do not rely on `vi` / `expect` / `test` as globals.** Vitest globals are **not** enabled, and the app tsconfig does not pull in `vitest/globals`. **Import explicitly:** `import { expect, test, vi } from 'vitest'` (and the helpers you use). This matches CI/Docker and avoids “works in the editor, fails in the container” drift.

### Browser E2E (Playwright)

End-to-end smoke lives under **`src/frontend/web/e2e/`** and targets **real** Analyze/Compare flows against a running **API + static UI** (same as production: nginx → SPA, `/api` → backend).

**Docker Compose layout (Phase 51)**

- **Default:** `docker compose up -d --build` (or **`make up`**) starts **`api`** + **`web`** only. No Playwright image, no browser automation stack.
- **Testing profile:** `docker compose --profile testing …` adds the **`playwright`** service (official image bundles Chromium; no separate Chrome container). Use together with **`--env-file .env.testing`** so the API sets **`PQAT_E2E_ENABLED=true`** → **`E2E__Enabled`** and seed routes work.
- **One-shot E2E:** `./scripts/e2e-playwright-docker.sh` — brings up **`api`** + **`web`** with **`.env.testing`**, waits for **`:3000`**, then runs Playwright project **`e2e-smoke`** (non-auth **`persisted-flows.spec.ts`**).

**Playwright projects (Phase 52–57)**

The API runs **one** `Auth:Mode` at a time. Each auth Playwright project must match the stack’s **`.env.testing.*`** file (see **`scripts/e2e-playwright-docker.sh`**). Running multiple **`--project=…`** flags against one stack is **not** supported.

| Project | Spec | Env file | What it proves |
|--------|------|----------|----------------|
| **`e2e-smoke`** | **`persisted-flows.spec.ts`**, **`theme-appearance.spec.ts`** | **`.env.testing`** | Non-auth persisted flows, **422** / **409**, Compare alias; **Phase 66** DOM theme switching + reload persistence (no screenshots) |
| **`e2e-auth-api-key`** | **`auth-artifact-access.spec.ts`** | **`.env.testing.auth`** | API key: Analyze owner/deny/group sharing |
| **`e2e-auth-jwt`** | **`jwt-auth-smoke.spec.ts`** | **`.env.testing.jwt`** | JWT: Analyze + Compare reopen, Compare denial |
| **`e2e-auth-proxy`** | **`proxy-auth-smoke.spec.ts`** | **`.env.testing.proxy`** | Trusted headers **`X-PQAT-User`**: Analyze reopen + denial |
| **`e2e-visual`** | **`visual/canonical.spec.ts`** | **`.env.testing`** | **4** tests, **region-targeted** PNGs (**Phase 75**): Analyze/Compare happy paths use labeled story surfaces (summary, workspace/navigator/pair, findings) — not full-page height; error cases capture **`analyze-page-error`** only; **Phase 65:** dark theme lock; see **`e2e/visual/README.md`** |

**npm scripts** (host Playwright; API must already match the mode): **`test:e2e`** / **`test:e2e:smoke`**, **`test:e2e:copy`** (**`e2e/persisted-flows.spec.ts`** only — Phase 72 clipboard + persisted Analyze/Compare smoke; same **`e2e-smoke`** project), **`test:e2e:auth`** (alias **`test:e2e:api-key`**), **`test:e2e:jwt`**, **`test:e2e:proxy`**, **`test:e2e:visual`** / **`test:e2e:visual:update`**.

**Sequential all auth modes (Docker):** **`./scripts/e2e-playwright-docker.sh --all-auth`** or **`make e2e-playwright-docker-all-auth`** — runs API-key, JWT, and proxy suites with **`docker compose … down -v`** between stacks.

**What runs (smoke)**

- Persisted **Analyze** share/reopen + **`?node=`** deep link
- **Phase 72:** **Analyze copy node reference** — clipboard read/write permission + **`data-testid="analyze-copy-node-reference"`** smoke
- Persisted **Compare** reopen + findings diff
- Lazy Compare **selected pair** shell → **Key metric deltas**
- **422** corrupt + **409** future-schema artifact errors (explicit UI copy)
- Compare **`?suggestion=`** legacy id → canonical highlight (**`alsoKnownAs`**)

**Fixtures**

- Plan JSON under **`src/frontend/web/e2e/fixtures/`** must match **`tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/postgres-json/`** for the bundled files. From **`src/frontend/web`**: **`npm run fixtures:sync`** (runs **`scripts/sync-e2e-fixtures.sh`**). CI runs **`npm run fixtures:check`** on the frontend job.

**API test-only seeds**

- When **`E2E:Enabled=true`** (via **`PQAT_E2E_ENABLED=true`** in **`.env.testing`**, or explicit env in non-Docker runs), the API exposes **`POST /api/e2e/seed/*`** routes to insert corrupt/future-schema rows and a comparison with suggestion aliases. **Default compose** leaves **`PQAT_E2E_ENABLED`** unset → seeds **off**. **Never** enable this in production deployments.

**How to run locally**

1. **Docker — non-auth smoke:** `./scripts/e2e-playwright-docker.sh` or **`make e2e-playwright-docker`**.
2. **Docker — API key:** **`--auth`** / **`make e2e-playwright-docker-auth`** (**`.env.testing.auth`**; **`page.route`** adds **`X-Api-Key`** on **`/api/*`**).
3. **Docker — JWT:** **`--jwt`** / **`make e2e-playwright-docker-jwt`** (**`.env.testing.jwt`**).
4. **Docker — proxy headers:** **`--proxy`** / **`make e2e-playwright-docker-proxy`** (**`.env.testing.proxy`**; **`installProxyHeadersRoute`** adds **`X-PQAT-User`** on **`/api/*`**).
5. **Docker — visual regression:** **`--visual`** / **`make e2e-playwright-docker-visual`** (**`.env.testing`**, **`e2e-visual`**).
6. **Docker — all auth modes in sequence:** **`--all-auth`** / **`make e2e-playwright-docker-all-auth`**.
7. **Compose manually:** `docker compose --env-file <file> up -d --build api web`, then  
   `docker compose --env-file <file> --profile testing run --rm -e PLAYWRIGHT_CLI_ARGS=--project=<project> playwright`  
   where **`<file>`** / **`<project>`** pair matches the table above (default **`PLAYWRIGHT_CLI_ARGS`** in compose is **`e2e-smoke`**).
8. **Host Playwright** on **:3000**: from **`src/frontend/web`**, **`PLAYWRIGHT_SKIP_WEBSERVER=1`**, **`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000`**, then the **`npm run test:e2e:*`** script that matches the running API.

**Vite dev + local API:** point the API at the same **`PQAT_*`** / **`Auth__*`** values as the matching **`.env.testing.*`**, run **`npm run dev`**, then Playwright with **`PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173`**.

Details: **`e2e/auth/README.md`**. Visual baselines: **`e2e/visual/README.md`**.

CI: **`ci.yml`** — **`backend`**, **`frontend`**, **`docker-smoke`**, **`e2e-playwright`**, auth/proxy E2E, **`e2e-playwright-visual`**, **`docs`**. **`workflow-lint.yml`** — **actionlint** when **`.github/workflows/**`** or **`.actionlint.yaml`** changes. E2E steps echo the matching **`e2e-playwright-docker.sh`** flag where applicable.

**Phase 73 (CI workflow):** **`.github/workflows/ci.yml`** must not use **unquoted** **`run:`** lines that contain **`#`** (YAML comment) or plain-text patterns like **`Local: ./…`** (the **`:`** + space can be parsed as a nested mapping). Quote the full shell string (see the workflow file header comment). The **`e2e-playwright`** job runs Docker Compose **`playwright`** with default **`PLAYWRIGHT_CLI_ARGS=--project=e2e-smoke`**, which already includes **`persisted-flows.spec.ts`** (clipboard + persisted flows). For a fast local repro of that slice only: stack up with **`.env.testing`**, then **`make test-e2e-copy`** or from **`src/frontend/web`**: **`PLAYWRIGHT_SKIP_WEBSERVER=1`**, **`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000`**, **`npm run test:e2e:copy`** (or full **`npm run test:e2e:smoke`**).

### Docs

Install:

```bash
python -m venv .venv-docs
source .venv-docs/bin/activate
pip install -r requirements-docs.txt
```

`requirements-docs.txt` pins **MkDocs** and the **mermaid2** plugin (diagrams on Architecture). Use this venv for `mkdocs serve` / `mkdocs build` so local builds match CI.

Serve:

```bash
mkdocs serve
```

Build:

```bash
mkdocs build --strict
```

## Adding a fixture

- Add the plan JSON under the appropriate fixture directory.
- Add a sibling `.sql` file (illustrative is fine; be honest).
- Run tests; fixture hygiene checks will enforce required companions.

## Adding a finding rule

- Add a rule under `src/backend/PostgresQueryAutopsyTool.Core/Findings/Rules/`
- Add unit tests that prove the rule triggers and that evidence is bounded.
- Update the findings catalog docs page.

