-- Illustrative query for fixture shape: Aggregate + Sort pattern.
-- Not guaranteed to reproduce exact operators without matching schema/dataset.

SELECT u.status, COUNT(*) AS n
FROM public.users AS u
GROUP BY u.status
ORDER BY n DESC;

