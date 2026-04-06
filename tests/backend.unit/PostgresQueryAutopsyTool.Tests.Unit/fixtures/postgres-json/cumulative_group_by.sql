-- Fixture companion: cumulative SUM() OVER (PARTITION BY … ORDER BY …) over a daily grid (see JSON for full EXPLAIN shape).
-- The `.json` file is sanitized EXPLAIN (FORMAT JSON) only (no psql headers) so tests can parse it directly.

WITH date_bounds AS (
                    SELECT
                        date_trunc('day', MIN(uploaded_at)) AS min_day,
                        date_trunc('day', MAX(uploaded_at)) AS max_day
                    FROM data_ingestion_catalog
                    WHERE endpoint IN ('/upload-batch/', '/upload-file/', '/upload-stream/')
                ),
                     days AS (
                         SELECT generate_series(
                                        (SELECT min_day FROM date_bounds),
                                        (SELECT max_day FROM date_bounds),
                                        interval '1 day'
                                ) AS ts
                     ),
                     endpoints AS (
                         SELECT 'upload' AS endpoint
                         UNION ALL
                         SELECT 'stream' AS endpoint
                     ),
                     counts AS (
                         SELECT
                             date_trunc('day', uploaded_at) AS ts,
                             CASE
                                 WHEN endpoint IN ('/upload-batch/', '/upload-file/') THEN 'upload'
                                 WHEN endpoint = '/upload-stream/' THEN 'stream'
                                 END AS endpoint,
                             COUNT(*)::bigint AS count
                FROM data_ingestion_catalog
                WHERE endpoint IN ('/upload-batch/', '/upload-file/', '/upload-stream/')
                GROUP BY 1, 2
                    ),
                     daily_grid AS (
                SELECT
                    d.ts,
                    e.endpoint,
                    COALESCE(c.count, 0)::bigint AS count_per_day
                FROM days d
                    CROSS JOIN endpoints e
                    LEFT JOIN counts c
                ON c.ts = d.ts
                    AND c.endpoint = e.endpoint
                WHERE d.ts IS NOT NULL
                    )
                SELECT
                    ts,
                    endpoint,
                    SUM(count_per_day) OVER (
                        PARTITION BY endpoint
                        ORDER BY ts
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS count
                FROM daily_grid
                ORDER BY ts, endpoint;