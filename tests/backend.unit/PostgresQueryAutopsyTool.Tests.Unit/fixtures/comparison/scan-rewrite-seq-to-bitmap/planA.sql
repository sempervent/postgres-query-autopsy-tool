-- Illustrative Plan A query for scan rewrite fixture (Seq Scan → Bitmap Heap Scan scenario).
-- Not guaranteed to produce bitmap plan without matching indexes/stats.

SELECT *
FROM public.products
WHERE category_id = 10;

