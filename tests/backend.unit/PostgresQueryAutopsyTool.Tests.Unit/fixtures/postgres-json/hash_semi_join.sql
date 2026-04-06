-- Illustrative shape: semi join (existence) between driving rows and a hashed inner lookup.
-- Actual strategy depends on statistics and predicates.

SELECT e.*
FROM public.events e
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = e.user_id);
