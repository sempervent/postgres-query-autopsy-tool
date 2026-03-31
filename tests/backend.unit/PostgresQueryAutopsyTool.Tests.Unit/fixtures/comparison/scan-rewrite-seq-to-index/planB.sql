-- Illustrative Plan B query for scan rewrite fixture: Index Scan on products via products_category_id_idx.

SELECT *
FROM public.products
WHERE category_id = 10;

