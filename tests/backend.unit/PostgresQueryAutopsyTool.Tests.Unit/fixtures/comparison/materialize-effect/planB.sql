-- Illustrative Plan B query for materialize-effect fixture.
-- Same logical join; materialization can appear depending on join order, work_mem, and repeated rescans.

SELECT o.*
FROM public.orders AS o
JOIN public.order_items AS oi
  ON oi.order_id = o.id
WHERE o.status = 'paid';

