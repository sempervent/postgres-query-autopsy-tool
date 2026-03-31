-- Illustrative query for comparison-fixture shape: Index Scan on products using products_category_id_idx.

SELECT *
FROM public.products
WHERE category_id = 10;

