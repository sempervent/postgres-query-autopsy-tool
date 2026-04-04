-- Illustrative query shape: CTE materialized/read via CTE Scan on the inner side of a nested loop.
-- Actual row counts and loops depend on data; the JSON fixture encodes a high-loop boundary case.

WITH heavy_cte AS (
  SELECT *
  FROM public.some_wide_table
  WHERE category = 'active'
)
SELECT o.id, c.*
FROM public.outer_t AS o
JOIN heavy_cte AS c ON c.outer_id = o.id;
