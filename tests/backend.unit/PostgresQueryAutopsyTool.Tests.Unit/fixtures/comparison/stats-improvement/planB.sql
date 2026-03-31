-- Illustrative Plan B query for stats improvement fixture.
-- Same query, improved estimates after ANALYZE / statistics refresh (illustrative).

SELECT *
FROM public.orders
WHERE created_at > now() - interval '7 days'
  AND status = 'paid';

