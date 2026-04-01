-- Illustrative TimescaleDB query (requires the `timescaledb` extension and matching schema).
-- Companion to `complex_timescaledb_query.json`: the JSON is the regression source of truth for a
-- real-world buffer-heavy plan (flat `Shared Read Blocks` / temp keys on nodes, Gather Merge,
-- partial aggregate with `Workers`, external merge sort with per-worker spill metadata, Append over
-- many chunk bitmap heap/index scans). This SQL matches the query shape; it is not guaranteed to
-- reproduce the fixture byte-for-byte.

SELECT
  time_bucket('5min', pd.time AT TIME ZONE 'UTC') AS time,
  pd.probe_uuid AS uuid,
  AVG(pd.value::FLOAT) * 1e9 AS value
FROM castdb.probe_data pd
WHERE
  pd.time BETWEEN '2025-12-11T21:57:27.213Z' AND '2026-03-29T20:57:27.213Z'
  AND pd.probe_uuid = ANY(ARRAY['a131b859-4297-440c-8b81-767c005ed4be']::text[])
GROUP BY
  time_bucket('5min', pd.time AT TIME ZONE 'UTC'),
  pd.probe_uuid
ORDER BY
  time_bucket('5min', pd.time AT TIME ZONE 'UTC'); 