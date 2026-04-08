# Postgres Query Autopsy Tool

[![CI](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/ci.yml)
[![Workflow lint](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/workflow-lint.yml/badge.svg)](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/workflow-lint.yml)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-222?logo=githubpages&logoColor=white)](https://sempervent.github.io/postgres-query-autopsy-tool/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![Node 20.18](https://img.shields.io/badge/node-20.18-339933?logo=nodedotjs)](https://nodejs.org/)

Forensic analysis for **PostgreSQL** execution plans: paste **`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)`**, get a normalized plan tree, evidence-backed **findings**, and a workstation-style **Analyze** / **Compare** UI (graph, guide rail, shareable persisted artifacts, optional auth). Built as a **.NET 8** API + **React** SPA, with **Playwright** smoke and **region-targeted** visual regression in CI.

---

### Documentation

| | |
|--|--|
| **Hosted manual** | **[GitHub Pages →](https://sempervent.github.io/postgres-query-autopsy-tool/)** |
| **Contributor guide** | [`docs/contributing.md`](docs/contributing.md) — [verification tiers](docs/contributing.md#verification-tiers-phase-80), [CI parity commands](docs/contributing.md#ci-parity-verified-commands), [digest / pin playbook](docs/contributing.md#container-image-pins--re-pinning-phase-7981) |
| **Issues** | **[`ISSUE.md`](ISSUE.md)** checklist + GitHub templates: **Bug report**, **Feature / enhancement** (`.github/ISSUE_TEMPLATE/`) |
| **Local docs** | `python -m venv .venv-docs && . .venv-docs/bin/activate && pip install -r requirements-docs.txt && mkdocs serve` (or reuse **`docs/.venv`** if present) |

The documentation site home page repeats the **badge row** above so the same trust signals appear on **MkDocs** (see [`docs/index.md`](docs/index.md)).

---

### Verification (trust paths)

Commands run from the **repository root** unless noted.

| You want | Command |
|-----------|---------|
| **Fastest** (host Node **20.18.x**) | `make repo-health` — workflow lint + `npm test` in `src/frontend/web` |
| **Fast + Docker frontend** (no host Node / Rolldown issues) | `make repo-health-docker` — lint + **`verify-frontend-docker`** (`npm ci`, **`fixtures:check`**, test, build; **full repo mounted** for fixture parity) |
| **Full, host toolchains** | `make verify` — lint + `dotnet test` + host frontend tests |
| **Full, Docker backend + frontend** | `make verify-docker` — matches “no host .NET / no host Node” CI-like flow |
| **Lint only** | `make lint-workflows` — actionlint via PATH, digest-pinned Docker, or `ACTIONLINT_BOOTSTRAP=1` (checksum-verified download) |

Details: **`make help`** and **[Contributing](docs/contributing.md)**.

**Phase 83 (Vitest / Rolldown on CI):** **`src/frontend/web/package.json`** declares **`optionalDependencies`** **`@rolldown/binding-*`** (pinned to the same version as the bundled Rolldown stack) so **`npm ci`** on **linux-x64** always installs the native addon. Stay on **Node 20.18.x** per **`engines`** / **`.nvmrc`**; if host Node is outside that range or tooling misbehaves, use **`make repo-health-docker`** / **`make verify-frontend-docker`**.

---

### Run the app (Docker Compose)

```bash
docker compose up --build
```

- UI: http://localhost:3000  
- API health: http://localhost:8080/api/health  

---

### What you get (MVP)

- Parse plan JSON → structured tree and metrics  
- Ranked **findings** with bounded evidence  
- **Compare** two plans (mapping, deltas, continuity cues)  
- Export **JSON / Markdown / HTML** reports  

---

### Repository layout

| Path | Role |
|------|------|
| `src/backend/` | .NET 8 API + analysis core |
| `src/frontend/web/` | React + TypeScript UI |
| `tests/backend.unit/` | xUnit + `postgres-json` fixtures |
| `docs/` | MkDocs source (published to Pages) |
| `scripts/` | Lint, E2E wrappers, fixture sync, frontend Docker verify |

**Source:** [github.com/sempervent/postgres-query-autopsy-tool](https://github.com/sempervent/postgres-query-autopsy-tool)
