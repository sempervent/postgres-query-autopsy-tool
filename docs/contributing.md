# Contributing

## Repo layout

- `src/backend/` .NET 8 API + core analysis engine
- `src/frontend/web/` React + TypeScript UI
- `tests/backend.unit/` xUnit tests + fixtures
- `docs/` documentation source (MkDocs)

## Node.js (frontend)

- **Supported:** Node **20.x** (matches CI and the **web** Docker build). **`src/frontend/web/.nvmrc`** is **`20`**; **`package.json`** has **`engines.node`** **`>=20 <25`**; optional **Volta** (`package.json` **`volta.node`**) and repo **`.tool-versions`** (asdf) pin **20.18.0**.
- **Avoid Node 25+** for local **`npm run build`** until the toolchain clearly supports it — optional native packages (e.g. Rolldown-related bindings) may not publish binaries for bleeding-edge Node versions.

## Development workflow

### Tests

```bash
make test
```

#### Frontend (Vitest + TypeScript)

- **`npm run build`** runs **`tsc -b`**, which typechecks **`src/**/*.tsx`** including **`src/test/`** (see `tsconfig.app.json`).
- **Unit tests:** **`npm test`** runs **`vitest run`** (single non-interactive pass — same as the **`frontend`** CI job). For local iteration use **`npm run test:watch`** (**`vitest`** watch mode). Avoid chaining extra **`--run`** flags; they are redundant with **`vitest run`**.
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
| **`e2e-smoke`** | **`persisted-flows.spec.ts`** | **`.env.testing`** | Non-auth persisted flows, **422** / **409**, Compare alias |
| **`e2e-auth-api-key`** | **`auth-artifact-access.spec.ts`** | **`.env.testing.auth`** | API key: Analyze owner/deny/group sharing |
| **`e2e-auth-jwt`** | **`jwt-auth-smoke.spec.ts`** | **`.env.testing.jwt`** | JWT: Analyze + Compare reopen, Compare denial |
| **`e2e-auth-proxy`** | **`proxy-auth-smoke.spec.ts`** | **`.env.testing.proxy`** | Trusted headers **`X-PQAT-User`**: Analyze reopen + denial |
| **`e2e-visual`** | **`visual/canonical.spec.ts`** | **`.env.testing`** | **4** canonical screenshots (Analyze/Compare happy, corrupt **422**, access denied via **`page.route` 403**); see **`e2e/visual/README.md`** |

**npm scripts** (host Playwright; API must already match the mode): **`test:e2e`** / **`test:e2e:smoke`**, **`test:e2e:auth`** (alias **`test:e2e:api-key`**), **`test:e2e:jwt`**, **`test:e2e:proxy`**, **`test:e2e:visual`** / **`test:e2e:visual:update`**.

**Sequential all auth modes (Docker):** **`./scripts/e2e-playwright-docker.sh --all-auth`** or **`make e2e-playwright-docker-all-auth`** — runs API-key, JWT, and proxy suites with **`docker compose … down -v`** between stacks.

**What runs (smoke)**

- Persisted **Analyze** share/reopen + **`?node=`** deep link
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

CI jobs **`e2e-playwright`**, **`e2e-playwright-auth`**, **`e2e-browser-auth-jwt`**, **`e2e-playwright-proxy`**, **`e2e-playwright-visual`**; each step echoes the matching **`e2e-playwright-docker.sh`** flag for local reproduction where applicable.

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

