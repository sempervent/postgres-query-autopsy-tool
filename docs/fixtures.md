# Fixtures & Sample SQL

Fixtures live under backend unit tests and are used to validate parsing, metrics, findings, and compare behavior.

## Why `.sql` companions exist

Execution plans are hard to reason about without a “query-shaped” anchor.

For many fixtures we provide a sibling `.sql` file that is **illustrative**:

- It is intended to plausibly produce a similar plan shape/operator pattern.
- It is not guaranteed to reproduce the fixture exactly unless explicitly noted.

## Conventions

### Single-plan fixtures

Directory: `tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/postgres-json/`

Convention:

- `foo.json` ↔ `foo.sql`

### Comparison fixtures

Directory: `tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/comparison/<name>/`

Convention:

- `planA.json` ↔ `planA.sql`
- `planB.json` ↔ `planB.sql`

## Adding a new fixture

1. Add the `.json` plan.
2. Add a sibling `.sql` query that matches relation names where possible.
3. If it’s illustrative, say so at the top of the SQL file.
4. Ensure fixture hygiene checks pass (CI will fail if required companions are missing).

## Realistic buffer-shape fixtures

- `pg_flat_buffers_seq_scan.json` — flat `Shared Read Blocks` / `Temp Read Blocks` style keys (no nested `Buffers` object), matching common PostgreSQL `EXPLAIN (BUFFERS)` JSON.
- `pg_workers_flat_buffers.json` — `Workers` array with per-worker buffer counters (and timing/rows for parser/UI tests); exercises merge when the gather node omits leader totals **and** typed preservation of each worker row on the normalized node.

## Large real-world regression fixture

- `complex_timescaledb_query.json` (+ `complex_timescaledb_query.sql`) — **TimescaleDB / chunk-heavy** plan shape used as an end-to-end regression asset (not a minimal synthetic). It includes:
  - top-level and nested **flat** buffer keys (`Shared Read Blocks`, temp read/write, and local fields)
  - substantial **temp I/O** and **external merge** sort (`Sort Method` / `Sort Space Type` on operators and on **worker** rows)
  - **Gather Merge**, partial/finalize **Aggregate**, and many **`Workers[]`** entries with per-worker buffers and sort metadata
  - **Append** over repeated **Bitmap Heap Scan** / **Bitmap Index Scan** pairs (hypertable chunks)

Backend tests use this file to guard buffer detection (`hasBuffers`, read hotspots, findings), parser normalization, worker preservation vs parent totals, and narrative buffer-aware branches. The SQL companion is illustrative (requires TimescaleDB and matching schema); the JSON is the source of truth for CI.

## Index-analysis fixtures (Phase 29)

- `index_scan_heap_heavy.json` — single `Index Scan` with large `Heap Fetches` and shared reads; drives **R.index-access-still-heavy** and structured `indexInsights`.
- `bitmap_recheck_waste.json` — `Bitmap Heap Scan` with `Recheck Cond` and `Rows Removed by Index Recheck`; drives **S.bitmap-recheck-attention**.
- `nl_inner_seq_index_support.json` — nested loop with repeated inner **Seq Scan**; drives **Q.nl-inner-index-support**.

`complex_timescaledb_query.json` is also used to assert **P.append-chunk-bitmap-workload** fires while **S** and per-chunk **R** on bitmap heaps are suppressed, so the product does not flatten that plan into a naive missing-index narrative.

## Compare + index delta regression (Phase 30)

- **`IndexComparisonAnalyzerTests`**: compares `complex_timescaledb_query.json` (Plan A) with `simple_seq_scan.json` (Plan B) to assert **chunked bitmap posture** lines in `indexComparison.overviewLines` and the `eitherPlanSuggestsChunkedBitmapWorkload` flag—realistic anchor that Compare’s index story stays conservative for hypertable/chunk plans.
- **Seq → index compare fixtures**: `compare_before_seq_scan.json` vs `compare_after_index_scan.json` exercise overview + insight diffs, pair **`indexDeltaCues`**, and narrative phrases.

