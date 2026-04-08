# Contributing

## Repo layout

- `src/backend/` .NET 8 API + core analysis engine
- `src/frontend/web/` React + TypeScript UI
- `tests/backend.unit/` xUnit tests + fixtures
- `docs/` documentation source (MkDocs)

## Issues (Phase 84)

Use **[`ISSUE.md`](https://github.com/sempervent/postgres-query-autopsy-tool/blob/main/ISSUE.md)** (file also at the repository root) for a structured bug report (Analyze / Compare / clipboard / CI / docs). On GitHub, **New issue → Bug report** points at the same expectations. For ideas and workflow improvements, **New issue → Feature / enhancement** (`.github/ISSUE_TEMPLATE/feature_request.md`) is available; paste **`PQAT analysis:`** / **`PQAT compare:`** reference blocks when the request ties to a specific snapshot.

### Clipboard / copy (Phase 87)

The UI tries **synchronous `document.execCommand('copy')` first**, then **`navigator.clipboard.writeText`**, and shows honest success/failure. **Vitest** often stubs **`execCommand`** so tests assert **`clipboard.writeText`**. Some browsers block clipboard APIs without a secure context or user gesture—when reporting copy bugs, paste the full **PQAT** reference block from the app into **`ISSUE.md`**-style repro steps.

## Status badges (Phase 81)

README (**repository root**) and **`docs/index.md`** (MkDocs home) share the **same shield row** (CI, workflow lint, docs, license, .NET, Node). When you add or change a badge, update **both** files so GitHub and GitHub Pages stay aligned. Prefer **repository workflow badges** (`…/actions/workflows/<file>/badge.svg`) and **shields.io** static badges over brittle third-party “live” counters.

## Verification tiers (Phase 80)

| Tier | Intent | Typical command |
|------|--------|-----------------|
| **A — fast host** | Lint + frontend unit tests only; smallest loop | **`make repo-health`** |
| **B — Docker frontend** | Same test/build as **CI `frontend`** (**`verify-frontend-docker.sh`**); no host Node / Rolldown binding issues | **`make repo-health-docker`** |
| **C — full local** | Lint + backend on PATH + host frontend tests | **`make verify`** |
| **D — full Docker** | Lint + Docker **.NET 8** + Docker Node frontend (max parity, minimal host deps) | **`make verify-docker`** |
| **Specialty** | E2E, visual PNGs, docs site, copy slice | **`make e2e-playwright-docker*`**, **`make docs-build`**, **`make test-e2e-copy`** |

**Workflow lint alone:** **`make lint-workflows`**. Order: **PATH** → **Docker** (digest-pinned **`rhysd/actionlint:1.7.7@sha256:887a…`**) → **`ACTIONLINT_BOOTSTRAP=1`** (downloads **`actionlint_${ver}_checksums.txt`** + tarball, **SHA256** must match upstream; needs **curl** + **openssl** / **sha256sum** / **shasum**) → error with hints. Optional **`make shellcheck-scripts`** if **shellcheck** is installed.

## CI parity (verified commands)

These paths mirror what **GitHub Actions** exercises (see **`.github/workflows/ci.yml`**, **`.github/workflows/workflow-lint.yml`**). Use **Docker-backed** backend tests when the host only has a newer .NET SDK/runtime.

| Concern | Command (repo root unless noted) |
|--------|----------------------------------|
| **Workflow YAML** | **`make lint-workflows`** or **`./scripts/lint-workflows.sh`** (same as **`workflow-lint.yml`**; Docker image digest-pinned; **`ACTIONLINT_BOOTSTRAP=1`** if no Docker — see [Verification tiers](#verification-tiers-phase-80)) |
| **Backend unit tests** | **`make test-backend`** (needs **.NET 8** on PATH) or **`make test-backend-docker`** (**.NET SDK 8** in Docker — digest-pinned in **`Makefile`**, matches **`PostgresQueryAutopsyTool.Api/Dockerfile`**) |
| **Frontend (host Node 20)** | **`cd src/frontend/web && npm ci && npm test && npm run build`** — convenient; may hit **Rolldown** optional-dep issues on some hosts (see below) |
| **Frontend (Docker — canonical CI path)** | **`make verify-frontend-docker`** or **`./scripts/verify-frontend-docker.sh`** — mounts **full repo** at **`/repo`**, runs in **`src/frontend/web`**: **`npm ci`**, **`npm run fixtures:check`**, **`npm test`**, **`npm run build`**. **This is what GitHub Actions `frontend` runs (Phase 91).** **Node 20 Alpine** digest-pinned; override **`PQAT_NODE_IMAGE`** if needed |
| **Docker images** | **`docker compose build`** (**`docker-smoke`** job) |
| **E2E smoke** (persisted flows + theme + copy capture) | **`make e2e-playwright-docker`** or **`./scripts/e2e-playwright-docker.sh`** (**`.env.testing`**, **`e2e-smoke`**) |
| **E2E visual** | **`make e2e-playwright-docker-visual`** or **`./scripts/e2e-playwright-docker.sh --visual`** |
| **Docs site** | Docs venv + **`mkdocs build --strict`** (see [Docs](#docs) below) |

**Shortcuts:** **`make verify`** = lint + host backend + host frontend tests; **`make verify-docker`** = lint + **`test-backend-docker`** + **`verify-frontend-docker`**. **`make repo-health`** / **`make repo-health-docker`** = tier A / B above. **`workflow-lint.yml`** runs only when workflow files or **`.actionlint.yaml`** change — still run **`make lint-workflows`** before pushing workflow edits.

### Container image pins & re-pinning (Phase 79–81)

Immutable **multi-arch index** digests are pinned for **Playwright**, **web** (**`node:20-alpine`**, **`nginx:alpine`**), **API** **.NET 8** images, **`Makefile`** **`test-backend-docker`**, **`scripts/verify-frontend-docker.sh`**, and **`scripts/lint-workflows.sh`** default **actionlint** Docker image.

**How to bump safely**

1. Choose the new **tag** (e.g. **`node:20-alpine`** after upstream refresh, or **`v1.53.0-jammy`** for Playwright — then bump **`@playwright/test`** in **`package.json`** to match).
2. Run **`docker buildx imagetools inspect <registry>/<image>:<tag>`** and copy the top-level **Digest** (manifest list / index).
3. Replace **`image@sha256:…`** in **`docker-compose.yml`**, **`Dockerfile`** files, **`Makefile`**, and any script default that embeds the same image — **one commit** per bump reduces drift.
4. Re-run **`docker compose build`**, **`make verify-frontend-docker`**, **`make verify-docker`**, and Playwright Docker suites if the bump touches browser or Node.
5. **`ACTIONLINT_BOOTSTRAP`**: if **`ACTIONLINT_VERSION_BOOTSTRAP`** / default Docker tag changes, confirm **`actionlint_${ver}_checksums.txt`** exists on the release (script verifies tarball against it).

**CI npm cache (Phase 81, superseded Phase 91 for `frontend` job):** The **`frontend`** job no longer uses **`setup-node`** / npm cache — it runs **`verify-frontend-docker.sh`** inside a container. Local contributors can still use **`actions/setup-node`** cache in forks if they customize workflows; upstream CI relies on Docker for deterministic installs.

### CI Node version (Phase 80)

**`.github/workflows/ci.yml`** **`frontend`** job uses **`actions/setup-node@v4`** with **`node-version: "20.18.0"`** — aligns with **`package.json`** **`volta.node`**, **`src/frontend/web/.nvmrc`**, and the **Node 20** line used in Docker (**Alpine** image is digest-pinned on **`node:20-alpine`**; it may trail **20.18.0** patch-for-patch — CI is the exact patch reference). When bumping **20.18.x**, update **`.nvmrc`**, **Volta**, **`ci.yml`**, and re-test **`verify-frontend-docker`**.

### npm audit (Phase 81)

**`npm audit`** is **not** a merge gate in CI. Treat reports as **triage**: fix high-impact issues in direct dependencies when practical; use **`npm audit fix`** only when lockfile churn is acceptable. Frontend CI stays **`npm ci`** + tests + build; security posture relies on pinned lockfiles, image digests, and periodic manual **`npm audit`** / Dependabot-style updates.

### GitHub Actions job families (`ci.yml` + `workflow-lint.yml`)

| Workflow / job | What it covers | Local parallel |
|----------------|----------------|----------------|
| **`workflow-lint.yml`** | **actionlint** on workflow edits | **`make lint-workflows`** |
| **`backend`** | **`dotnet test`** solution | **`make test-backend`** |
| **`frontend`** | **`./scripts/verify-frontend-docker.sh`** (Docker; same as **`make verify-frontend-docker`**) | **`make verify-frontend-docker`** — **not** host **`npm ci`** (Phase 91) |
| **`docker-smoke`** | **`docker compose build`** | **`docker compose build`** |
| **`e2e-playwright`** | Compose **`playwright`** → **`e2e-smoke`** | **`make e2e-playwright-docker`** |
| **`e2e-playwright-auth` / `jwt` / `proxy`** | Auth projects + matching **`.env.testing.*`** | **`make e2e-playwright-docker-auth`** (etc.) |
| **`e2e-playwright-visual`** | **`e2e-visual`** PNG suite | **`make e2e-playwright-docker-visual`** |
| **`docs`** | **`mkdocs build --strict`** | **`make docs-build`** |

## Repo health, workflows, and .NET runtime (Phase 74)

**Workflow lint:** [**actionlint**](https://github.com/rhysd/actionlint) via **`./scripts/lint-workflows.sh`**. Config: **`.actionlint.yaml`**. **`.github/workflows/workflow-lint.yml`** runs this script (path-scoped); do **not** use **`uses: rhysd/actionlint@v1`**. **Without Docker:** install **actionlint** on **PATH**, or **`ACTIONLINT_BOOTSTRAP=1 ./scripts/lint-workflows.sh`** (checksum-verified download to **`.cache/pqat-actionlint/`**). Clear the cache after changing **`ACTIONLINT_VERSION_BOOTSTRAP`**.

**Host Vitest / optional native bindings (Phase 76 + 79 + 83 + 91):** **`src/frontend/web/package.json`** **`optionalDependencies`** lists **`@rolldown/binding-*`** platforms to help **host** **`npm ci`**. **GitHub Actions `frontend`** (Phase **91**) runs **`./scripts/verify-frontend-docker.sh`** so CI does **not** depend on the hosted runner’s npm optional-dep resolution. If **local** **`npm test`** fails with **“Cannot find native binding”**, use **`make verify-frontend-docker`** — the same install/test/build as CI. **Alternatively:** clean **`node_modules`** and **`npm ci`** on **Node 20.18.x** (**`engines`** / **`.nvmrc`** / **`volta`**). Avoid **Node 25+** until the stack officially supports it (**`engines`** caps **&lt;25**).

**Clipboard tests (Phase 84 + 86):** Unit tests **`spyOn(document, 'execCommand').mockReturnValue(false)`** so **`navigator.clipboard.writeText`** is exercised (jsdom often lacks a real copy implementation). **`src/test/setup.ts`** defines a no-op **`execCommand`** when absent. Playwright **`installE2eClipboardCapture`** wraps both **`writeText`** and **`execCommand('copy')`** so E2E asserts match production order (**sync exec first**). **Phase 86** extends **`persisted-flows.spec.ts`** with **Compare Copy link** (URL + **`PQAT compare:`**) and **Analyze suggested EXPLAIN** copy; use **`page.getByLabel`** (not **`getByLabelText`**) for Playwright locators.

**Make shortcuts** (run from repo root; **`make help`** lists all):

| Goal | Command |
|------|---------|
| Fast sanity (lint + frontend tests on host) | **`make repo-health`** — if Vitest fails, **`make repo-health-docker`** |
| Fast sanity (lint + Docker frontend) | **`make repo-health-docker`** — no host Node required for the frontend leg |
| Full local verify (lint + backend on PATH + frontend on host) | **`make verify`** — requires **.NET 8 runtime** for **`dotnet test`** (same as CI **`backend`** job) |
| Full verify without host .NET / reliable Node | **`make verify-docker`** — lint + **`test-backend-docker`** + **`verify-frontend-docker`** |
| Frontend only (Docker, CI-like) | **`make verify-frontend-docker`** |
| Backend unit tests only (Docker) | **`make test-backend-docker`** |
| Copy/persisted-flow Playwright slice (host) | **`make test-e2e-copy`** — requires **`api` + `web`** on **`:3000`** with **`.env.testing`** (see [Browser E2E](#browser-e2e-playwright)); equivalent to **`npm run test:e2e:copy`** in **`src/frontend/web`** with **`PLAYWRIGHT_*`** env set |
| Shell script static analysis (optional) | **`make shellcheck-scripts`** — requires **`shellcheck`** on **PATH** |

**Analyze fixture sweep** is still **`PostgresJsonAnalyzeFixtureSweepTests`** plus **`Support/AnalyzeFixtureCorpus*`**; there is no separate CLI — run **`make test-backend-docker`** or **`dotnet test`** on the unit project to execute it.

## Node.js (frontend)

- **Supported:** Node **20.18.0** for parity with **CI** (**`ci.yml`** **`setup-node`**) and **Volta** / **asdf** pins. **`src/frontend/web/.nvmrc`** is **`20.18.0`**; **`package.json`** **`engines.node`** remains **`>=20 <25`**. **Docker** frontend verification uses digest-pinned **Node 20 Alpine** (same major line).
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

- **Web image (`src/frontend/web/Dockerfile`):** **`npm ci`** runs before **`COPY . .`**. A **`.dockerignore`** in that directory keeps host **`node_modules`** / **`dist`** out of the build context so the final copy does not overwrite the image’s dependencies (Phase 76). If **`docker compose build web`** fails with odd **`tsc`** / “is not a module” errors, confirm you are not bypassing Docker with a broken context.
- **Default:** `docker compose up -d --build` (or **`make up`**) starts **`api`** + **`web`** only. No Playwright image, no browser automation stack.
- **Testing profile:** `docker compose --profile testing …` adds the **`playwright`** service (official image bundles Chromium; no separate Chrome container). Use together with **`--env-file .env.testing`** so the API sets **`PQAT_E2E_ENABLED=true`** → **`E2E__Enabled`** and seed routes work.
- **One-shot E2E:** `./scripts/e2e-playwright-docker.sh` — brings up **`api`** + **`web`** with **`.env.testing`**, waits for **`:3000`**, then runs Playwright project **`e2e-smoke`** (non-auth **`persisted-flows.spec.ts`**).

**Playwright projects (Phase 52–57)**

The API runs **one** `Auth:Mode` at a time. Each auth Playwright project must match the stack’s **`.env.testing.*`** file (see **`scripts/e2e-playwright-docker.sh`**). Running multiple **`--project=…`** flags against one stack is **not** supported.

| Project | Spec | Env file | What it proves |
|--------|------|----------|----------------|
| **`e2e-smoke`** | **`persisted-flows.spec.ts`**, **`theme-appearance.spec.ts`** | **`.env.testing`** | Non-auth persisted flows, **422** / **409**, Compare deep-link + **Pair scope** copy, **`suggestion=`** / **`finding=`** / **`indexDiff=`** reopen highlights + URL bar checks, **Phase 66** theme (no screenshots) |
| **`e2e-auth-api-key`** | **`auth-artifact-access.spec.ts`** | **`.env.testing.auth`** | API key: Analyze owner/deny/group sharing + **Copy artifact link** clipboard payload (**URL** + **`PQAT analysis:`**, Phase 88) |
| **`e2e-auth-jwt`** | **`jwt-auth-smoke.spec.ts`** | **`.env.testing.jwt`** | JWT: Analyze + Compare reopen, Compare denial, **Compare Copy link** clipboard (**URL** + **`PQAT compare:`** + **`Pair ref:`**) |
| **`e2e-auth-proxy`** | **`proxy-auth-smoke.spec.ts`** | **`.env.testing.proxy`** | Trusted headers **`X-PQAT-User`**: Analyze reopen + denial; **Compare Copy link** clipboard (**URL** + **`PQAT compare:`** + **`Pair ref:`**, Phase 91) |
| **`e2e-visual`** | **`visual/canonical.spec.ts`** | **`.env.testing`** | **4** tests, **region-targeted** PNGs: Analyze uses **`analyze-visual-summary-contract`**; Compare summary uses **`[aria-labelledby="compare-summary-heading"]`**; navigator/pair use **`aria-label`**; errors: **`analyze-page-error`** only; see **`e2e/visual/README.md`** |

**npm scripts** (host Playwright; API must already match the mode): **`test:e2e`** / **`test:e2e:smoke`**, **`test:e2e:copy`** (**`e2e/persisted-flows.spec.ts`** only — Phase 72 clipboard + persisted Analyze/Compare smoke; same **`e2e-smoke`** project), **`test:e2e:auth`** (alias **`test:e2e:api-key`**), **`test:e2e:jwt`**, **`test:e2e:proxy`**, **`test:e2e:visual`** / **`test:e2e:visual:update`**.

**Sequential all auth modes (Docker):** **`./scripts/e2e-playwright-docker.sh --all-auth`** or **`make e2e-playwright-docker-all-auth`** — runs API-key, JWT, and proxy suites with **`docker compose … down -v`** between stacks.

**What runs (smoke)**

- Persisted **Analyze** share/reopen + **`?node=`** deep link
- **Phase 72 + 77:** **Analyze copy node reference** — **`data-testid="analyze-copy-node-reference"`** + **`e2e/helpers/e2eClipboardCapture.ts`** stubs **`navigator.clipboard.writeText`** and asserts the payload (avoids **`readText()`**, often missing in CI Chromium)
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

