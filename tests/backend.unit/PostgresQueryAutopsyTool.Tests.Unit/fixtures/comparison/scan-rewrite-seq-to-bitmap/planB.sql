-- Illustrative Plan B query for scan rewrite fixture (bitmap access path).
-- Typically requires an index on (category_id) and data distribution that favors bitmap heap scan.

SELECT *
FROM public.products
WHERE category_id = 10;

