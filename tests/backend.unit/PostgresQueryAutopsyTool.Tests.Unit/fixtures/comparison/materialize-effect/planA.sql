-- Illustrative Plan A query for materialize-effect fixture.
-- Nested loop without explicit materialization (illustrative).

SELECT o.*
FROM public.orders AS o
JOIN public.order_items AS oi
  ON oi.order_id = o.id
WHERE o.status = 'paid';

