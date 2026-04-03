# Capturing EXPLAIN JSON

This tool works best with **JSON-format** plans that include **timing** and **buffer** evidence.

## Recommended forms

### Fast shape-only capture (no execution)

Useful for structure, but no timings/buffers:

```sql
EXPLAIN (FORMAT JSON)
SELECT ...;
```

### Forensic capture (executes the query)

Recommended for real autopsies:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)
SELECT ...;
```

Planner **`COSTS`** default to **on** in PostgreSQL. You can omit them or disable them explicitly:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, COSTS false, FORMAT JSON)
SELECT ...;
```

The autopsy tool **does not require** `Startup Cost` / `Total Cost` / `Plan Rows` / `Plan Width` in the JSON. It **detects** whether those fields appear on plan nodes (`summary.plannerCosts`: `present`, `notDetected`, `mixed`, or `unknown`) and still uses **actual timing**, **buffers**, and findings when costs are absent.

## Why `FORMAT JSON` matters

- It preserves the plan tree and operator fields in a structured form.
- It avoids copy/paste and parsing ambiguity of text plans.
- It allows the tool to extract operator-specific evidence (hash batches, sort spill, workers planned/launched, rows removed, etc.).

## Why `ANALYZE` and `BUFFERS` matter

- `ANALYZE` populates actual time/rows, enabling “where time went” hotspots.
- `BUFFERS` populates shared reads/hits, enabling I/O hotspot detection.

Without them, analysis is still useful but less forensic.

## Pasting into the tool

1. Copy plan output from `psql` or your client. **Phase 35** accepts either:
   - **Plain JSON** — the usual array (or object) from `EXPLAIN (…, FORMAT JSON)`, or
   - **`psql` tabular output** — a result grid whose first column header is **QUERY PLAN**, optional dashed separator rows, the JSON in the cell body (often with `|` borders), optional **`(N rows)`** footer, and **line wraps** where physical lines end with **`+`** (continuation). The API strips those wrappers and reconstructs one JSON string before parsing.
2. Paste into the **Input plan** box on the Analyze page (same field for both shapes).
3. Optionally paste the SQL text into **Source SQL query** (for orientation; best-effort only). It is **stored with the analysis** when sent and survives **reopened share links** (`?analysis=…`).
4. Optionally use **Suggested EXPLAIN command** on Analyze: toggles for `ANALYZE`, `VERBOSE`, `BUFFERS`, and explicit **`COSTS true` / `COSTS false`**, plus copy-paste SQL. Check **Send EXPLAIN options with analyze request** to store declared options and an optional “recorded command” in the API result (`explainMetadata`) and in Markdown/HTML exports.

After a successful analyze, the UI shows a short **input normalization** line when applicable (e.g. “Parsed raw JSON directly” vs “Normalized pasted QUERY PLAN output”). If normalization cannot produce valid JSON, the API returns **`plan_parse_failed`** with a message and hint (no silent mangling).

### Share links and persistence (Phase 35–36)

- Each successful **`POST /api/analyze`** writes the full **`PlanAnalysisResult`** JSON into **SQLite** (path from **`Storage:DatabasePath`**, default `data/autopsy.db`) and returns an opaque **`analysisId`** (32-char hex).
- The Analyze URL can include **`?analysis=<id>&node=<nodeId>`** so others can reopen the same snapshot **without reposting JSON**. Use **Copy share link** (distinct from **Copy reference** and **Copy suggested EXPLAIN**).
- **Durable vs ephemeral:** share links **survive API process restarts** as long as the **same database file** is mounted or preserved (e.g. Docker volume on `/app/data`). Deleting the file, TTL expiry, or **`MaxArtifactRows`** pruning can still drop ids. There is **no authentication**; treat ids as capability URLs in untrusted networks.

### Normalizer limitations

- The normalizer targets **common copied `psql` shapes** that still contain intact JSON. It is **not** a full terminal or SQL parser.
- A **`+`** at the end of a wrapped line is treated as a **line-continuation marker**. If a line break falls inside a JSON string such that a **`+`** is actually part of the string content at end-of-line, reconstruction could be wrong; prefer copying the raw JSON cell when in doubt.

## Caveats

- Running `ANALYZE` executes the query; consider `EXPLAIN (ANALYZE, BUFFERS)` on non-production replicas if needed.
- Plans are sensitive to parameters, data distribution, and settings (`work_mem`, parallelism).

