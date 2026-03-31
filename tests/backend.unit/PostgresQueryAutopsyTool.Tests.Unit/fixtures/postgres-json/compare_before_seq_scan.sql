-- Illustrative query for comparison-fixture shape: Seq Scan on products with a filter.

SELECT *
FROM public.products
WHERE category_id = 10;

