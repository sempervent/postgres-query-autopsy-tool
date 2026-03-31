-- Illustrative Plan A query for scan rewrite fixture: Seq Scan on products with category_id filter.

SELECT *
FROM public.products
WHERE category_id = 10;

