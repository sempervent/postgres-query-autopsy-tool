-- Representative shape: PostgreSQL EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)
-- emits buffer counters as flat keys on each plan node (not only under a nested "Buffers" object).
-- The JSON fixture is hand-edited from a real plan; this SQL is illustrative only.

SELECT pd.probe_uuid, AVG(pd.value::double precision)
FROM castdb.probe_data pd
WHERE pd.time BETWEEN timestamptz '2025-12-11 21:57:27.213Z' AND timestamptz '2026-03-29 20:57:27.213Z'
  AND pd.probe_uuid = ANY (ARRAY['a131b859-4297-440c-8b81-767c005ed4be']::text[])
GROUP BY pd.probe_uuid;
