-- Illustrative query for fixture shape: Seq Scan on users with a filter.
-- Not guaranteed to reproduce the exact costs/timing without a matching dataset.

SELECT u.id
FROM public.users AS u
WHERE u.status = 'active';

