-- Illustrative query for fixture shape: Nested Loop with a potentially misleading plan-row estimate.
-- Not guaranteed to reproduce estimate errors without matching statistics/data.

SELECT c.id, li.*
FROM public.customers AS c
JOIN public.line_items AS li
  ON li.customer_id = c.id
WHERE c.region = 'us';

