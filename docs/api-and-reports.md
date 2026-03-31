# API & Reports

## API endpoints (high-level)

- `POST /api/analyze`
  - body: `{ plan: <json>, queryText?: string | null }`
  - response: `PlanAnalysisResult` (includes `queryText` when provided)
- `POST /api/compare`
  - body: `{ planA: <json>, planB: <json> }`
  - query: `?diagnostics=1` to include matcher diagnostics

## Reports

- `POST /api/report/markdown` / `POST /api/report/html` / `POST /api/report/json`
- `POST /api/compare/report/markdown` / `POST /api/compare/report/json`

### Markdown report notes

- Uses human-readable node labels in key places.
- Includes a `Source Query` section when `queryText` is present in the analysis.

