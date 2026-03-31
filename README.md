# Postgres Query Autopsy Tool

A serious forensic tool for PostgreSQL execution plans, with an interactive UI that helps explain why a query is slow, misleading, memory-heavy, buffer-heavy, or structurally cursed.

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

