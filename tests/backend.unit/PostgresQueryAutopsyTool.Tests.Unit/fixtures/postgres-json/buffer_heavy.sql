-- Illustrative query for fixture shape: large scan + sort that is buffer/temp heavy.
-- Intended operator pattern: Seq Scan feeding Sort with high Shared Read Blocks and temp I/O.
-- Not guaranteed to reproduce the exact BUFFERS numbers without a matching dataset.

SELECT *
FROM public.events_big
ORDER BY created_at DESC;

