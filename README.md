# Postgres Query Autopsy Tool

A serious forensic tool for PostgreSQL execution plans, with an interactive UI that helps explain why a query is slow, misleading, memory-heavy, buffer-heavy, or structurally cursed.

## Docs

- Local docs site:

```bash
python -m venv .venv-docs
source .venv-docs/bin/activate
pip install -r requirements-docs.txt
mkdocs serve
```

- Published docs: GitHub Pages (workflow included). Update `mkdocs.yml` `repo_url` after you set the repo location.

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

