# API & Reports

## API endpoints (high-level)

- `POST /api/analyze`
  - body: `{ plan: <json>, queryText?: string | null }`
  - response: `PlanAnalysisResult` (includes `queryText` when provided)
  - `summary.hasBuffers`: true if any plan node has at least one buffer counter (shared, local, or temp hit/read/dirtied/written fields). Populated from PostgreSQL’s flat per-node JSON keys and/or nested `Buffers`, with optional aggregation from `Workers` when the parent omits totals.
  - Each analyzed node’s `node` object may include `workers`: an array of typed per-worker stats (camelCase fields mirroring `PlanWorkerStats`—worker number, actual timing/rows/loops, shared/local/temp buffers, optional sort metadata) when the plan JSON contained a `Workers` array. Parent-level buffer and timing fields on `node` stay as reported by PostgreSQL for the leader/aggregate; worker rows are additional detail, not a second copy of the same totals.
  - `indexOverview`: plan-level rollup (counts of seq / index / bitmap scans, `suggestsChunkedBitmapWorkload`, optional `chunkedWorkloadNote`).
  - `indexInsights`: bounded list of node-targeted investigation hints (`accessPathFamily`, `signalKinds`, `headline`, compact `facts`) produced by `IndexSignalAnalyzer`—useful for Analyze UI and future compare diffs; not a second findings engine.
  - `optimizationSuggestions` (Phase 32+33): ranked `OptimizationSuggestion[]` with string enums (`category`, `suggestedActionType`, `confidence`, `priority`), **`suggestionId`** (`sg_*` hash), human titles/summaries, evidence links (`targetNodeIds`, `relatedFindingIds`, `relatedIndexInsightNodeIds`), optional compare-only **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`**, `cautions`, and `validationSteps`. Investigation-oriented only.
- `POST /api/compare`
  - body: `{ planA: <json>, planB: <json> }`
  - query: `?diagnostics=1` to include matcher diagnostics
  - response: `PlanComparisonResultV2` includes **`indexComparison`**: `overviewLines`, `insightDiffs` (each with **`insightDiffId`** `ii_*`, **`kind`** as lowercase JSON strings `new`/`resolved`/`improved`/`worsened`/`changed`/`unchanged`, `summary`, optional node/insight fields, access-path families, **`relatedFindingDiffIds`** / legacy **`relatedFindingDiffIndexes`** into **`findingsDiff.items`**), `narrativeBullets`, `eitherPlanSuggestsChunkedBitmapWorkload`. **`findingsDiff.items[]`** include **`diffId`** `fd_*`, **`relatedIndexDiffIds`**, and legacy **`relatedIndexDiffIndexes`**. **`pairDetails[]`** include **`pairArtifactId`** `pair_*`, **`indexDeltaCues`**, and **`corroborationCues`**. **`compareOptimizationSuggestions`**: same `OptimizationSuggestion` shape as analyze (including optional compare-only diff id arrays).

## Reports

- `POST /api/report/markdown` / `POST /api/report/html` / `POST /api/report/json`
- `POST /api/compare/report/markdown` / `POST /api/compare/report/json`

### Markdown report notes

- Uses human-readable node labels in key places.
- Includes a `Source Query` section when `queryText` is present in the analysis.
- Analyze markdown/HTML include an **Optimization suggestions** section when the engine produced items (headline findings and appendix lines include **`findingId`** / **`suggestionId`** in backticks for cross-reference). Compare markdown adds **Next steps after this change (compare)** when `compareOptimizationSuggestions` is non-empty, uses **`[fd_*]`** / **`[ii_*]`** / **`[pair_*]`** style references instead of raw positional indices where possible, and still falls back to `#n` only when ids are absent.

