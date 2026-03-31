-- Illustrative query for fixture shape: Nested Loop where inner index scan is executed many times.
-- Not guaranteed to reproduce loop counts without matching data distribution.

SELECT c.id, li.*
FROM public.customers AS c
JOIN public.line_items AS li
  ON li.customer_id = c.id
WHERE c.region = 'us';

