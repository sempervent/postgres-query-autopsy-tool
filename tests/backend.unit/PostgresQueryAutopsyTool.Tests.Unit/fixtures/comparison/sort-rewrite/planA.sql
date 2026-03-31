-- Illustrative Plan A query for sort rewrite fixture: explicit sort.

SELECT *
FROM public.events
ORDER BY created_at DESC;

