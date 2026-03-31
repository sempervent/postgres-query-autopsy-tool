-- Illustrative Plan B query for sort rewrite fixture.
-- Incremental Sort often appears when input is already partially ordered (illustrative).

SELECT *
FROM public.events
ORDER BY created_at DESC;

