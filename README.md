# Postgres Query Autopsy Tool

A serious forensic tool for PostgreSQL execution plans, with an interactive UI that helps explain why a query is slow, misleading, memory-heavy, buffer-heavy, or structurally cursed.

## Documentation

**Hosted docs (MkDocs on GitHub Pages):**  
**[https://sempervent.github.io/postgres-query-autopsy-tool/](https://sempervent.github.io/postgres-query-autopsy-tool/)**

**Local preview** (edit `docs/`, same toolchain as CI `docs` job):

```bash
python -m venv .venv-docs
source .venv-docs/bin/activate
pip install -r requirements-docs.txt
mkdocs serve
```

**Match CI locally:** **[Verification tiers](docs/contributing.md#verification-tiers-phase-80)** + **[CI parity table](docs/contributing.md#ci-parity-verified-commands)** in `docs/contributing.md`.

**Quick checks (repo root):** **`make help`** lists the verification tiers. Short version: **`make repo-health`** when the host has Node **20.18.x** (matches CI). If host Node is wrong or Vitest/Rolldown fails, use **`make repo-health-docker`** (workflow lint + **`npm ci` / test / build** in the digest-pinned Node image — no host Node needed). Full CI-like stack without host **.NET 8** or Node: **`make verify-docker`**. Workflow lint with no Docker: install [**actionlint**](https://github.com/rhysd/actionlint) or run **`ACTIONLINT_BOOTSTRAP=1 ./scripts/lint-workflows.sh`** (downloads v**1.7.7** to **`.cache/`**, needs **curl**).

## What you can do (MVP)

1. Upload/paste PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` output.
2. Parse it into a normalized plan tree.
3. Compute evidence-based diagnostics and ranked “autopsy findings”.
4. Export reports as JSON, Markdown, and HTML.

## Run locally (Docker Compose)

```bash
docker compose up --build
```

Then open:
- Frontend: http://localhost:3000
- Backend health: http://localhost:8080/api/health

## Repo structure

- `src/backend/` .NET 8 API + core analysis engine
- `src/frontend/web/` React + TypeScript UI
- `tests/backend.unit/` fixtures + backend unit tests
- `docs/` MkDocs docs source
