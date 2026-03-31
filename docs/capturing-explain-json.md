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

## Why `FORMAT JSON` matters

- It preserves the plan tree and operator fields in a structured form.
- It avoids copy/paste and parsing ambiguity of text plans.
- It allows the tool to extract operator-specific evidence (hash batches, sort spill, workers planned/launched, rows removed, etc.).

## Why `ANALYZE` and `BUFFERS` matter

- `ANALYZE` populates actual time/rows, enabling “where time went” hotspots.
- `BUFFERS` populates shared reads/hits, enabling I/O hotspot detection.

Without them, analysis is still useful but less forensic.

## Pasting into the tool

1. Copy the full JSON output (usually an array containing a top-level object with `"Plan"`).
2. Paste into the **Plan JSON** box on the Analyze page.
3. Optionally paste the SQL text into **Source SQL query** (for orientation; best-effort only).

## Caveats

- Running `ANALYZE` executes the query; consider `EXPLAIN (ANALYZE, BUFFERS)` on non-production replicas if needed.
- Plans are sensitive to parameters, data distribution, and settings (`work_mem`, parallelism).

