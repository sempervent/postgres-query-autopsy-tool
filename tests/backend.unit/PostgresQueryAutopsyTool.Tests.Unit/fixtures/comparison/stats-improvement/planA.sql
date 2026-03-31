-- Illustrative Plan A query for stats improvement fixture.
-- Same query, worse row estimates due to stale/inaccurate statistics (illustrative).

SELECT *
FROM public.orders
WHERE created_at > now() - interval '7 days'
  AND status = 'paid';

