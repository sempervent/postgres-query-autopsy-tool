# API & Reports

## API endpoints (high-level)

### Storage (Phase 36)

- Analyses and comparisons are persisted in a **SQLite** file (default `data/autopsy.db` under the API content root, overridable with **`Storage:DatabasePath`**).
- **`Storage:ArtifactTtlHours`** (optional): when greater than `0`, rows get an **`expires_utc`** and are purged on read and at startup; `0` or omitted means **no TTL** in typical config (see `appsettings.json`).
- **`Storage:MaxArtifactRows`** (optional): when greater than `0`, oldest rows are deleted after inserts to cap total artifact rows (analyses + comparisons).
- Payloads are **full JSON snapshots** of **`PlanAnalysisResult`** / **`PlanComparisonResultV2`** (same shape as API responses)—not recomputed from raw plan text on read.

### `POST /api/analyze`

- body (either shape):
  - **Preferred (Phase 35):** `{ planText: string, queryText?: string | null, explainMetadata?: … }` — `planText` is raw pasted text. The server runs **`PlanInputNormalizer`**: trims, accepts JSON starting with `{`/`[`, or strips a **`QUERY PLAN`** / `psql` table wrapper, joins lines ending in **`+`**, drops **`(N rows)`** footers, then parses JSON. On failure: **400** `{ error: "plan_parse_failed", message, hint }`.
  - **Legacy:** `{ plan: <json element>, queryText?, explainMetadata? }` — omit or leave `planText` empty; `plan` must be the JSON body. No `planInputNormalization` is set (null).
- response: `PlanAnalysisResult` (includes `queryText` when provided; **`explainMetadata`** echoed when the client sent non-empty metadata after server normalization). When `planText` was used: **`planInputNormalization`**: `{ kind: "rawJson" | "queryPlanTable", detail? }`.
- `summary.plannerCosts`: string enum **`present`** | **`notDetected`** | **`mixed`** | **`unknown`** — inferred from whether plan nodes carry `Startup Cost` / `Total Cost` / `Plan Rows` / `Plan Width` (not from declared EXPLAIN options).
- `summary.hasBuffers`: true if any plan node has at least one buffer counter (shared, local, or temp hit/read/dirtied/written fields). Populated from PostgreSQL’s flat per-node JSON keys and/or nested `Buffers`, with optional aggregation from `Workers` when the parent omits totals.
- Each analyzed node’s `node` object may include `workers`: an array of typed per-worker stats (camelCase fields mirroring `PlanWorkerStats`) when the plan JSON contained a `Workers` array.
- `indexOverview`, `indexInsights`, `optimizationSuggestions` as in prior phases.

### `GET /api/analyses/{analysisId}`

- returns the stored **`PlanAnalysisResult`**; **404** `{ error: "analysis_not_found", analysisId }` if missing or expired.

### `GET /api/analyses`

- lists analysis ids (debug-oriented; ordering not a strict contract).

### `POST /api/compare`

- body (per side: **text or JSON**, not both required on a side if the other form is provided):
  - **`planAText`** / **`planBText`** (optional): same normalization as Analyze **`planText`**.
  - **`planA`** / **`planB`**: raw JSON elements (legacy).
  - **`queryTextA`** / **`queryTextB`**, **`explainMetadataA`** / **`explainMetadataB`** (optional): passed into **`AnalyzeAsync`** for that side before the comparison engine runs. Embedded **`planA`** / **`planB`** on the result carry query text, metadata, and **`planInputNormalization`** when applicable.
- **400** `{ error: "plan_parse_failed", side, message, hint }` if normalization fails for that side.
- **400** `{ error: "plan_required", side, message }` if a side has neither text nor JSON.
- query: `?diagnostics=1` for matcher diagnostics.
- response: **`PlanComparisonResultV2`** (unchanged high-level shape; **`planA`** / **`planB`** are full analyze snapshots).

### `GET /api/comparisons/{comparisonId}`

- returns the stored comparison JSON; **404** `{ error: "comparison_not_found", comparisonId }` if missing/expired.

### Reports

- `POST /api/report/markdown` / `POST /api/report/html` / `POST /api/report/json`
- `POST /api/compare/report/markdown` / `POST /api/compare/report/json` — compare report endpoints use the **same compare request body** as `POST /api/compare` (including **`planAText`** / **`planBText`** and per-side metadata).

### Markdown report notes

- Uses human-readable node labels in key places.
- Includes a `Source Query` section when `queryText` is present in the analysis.
- Adds **Plan capture & EXPLAIN context** with detected planner-cost presence and any **declared** `explainMetadata` (options line + optional recorded command).
- **Compare** markdown adds a **Plan capture & EXPLAIN context (per side)** section summarizing Plan A and Plan B (query present/absent, input normalization kind, planner costs, declared options, recorded command).
- Analyze markdown/HTML include an **Optimization suggestions** section when the engine produced items. Compare markdown adds **Next steps after this change (compare)** when `compareOptimizationSuggestions` is non-empty, with **`[fd_*]`** / **`[ii_*]`** / **`[pair_*]`** style references where possible.
