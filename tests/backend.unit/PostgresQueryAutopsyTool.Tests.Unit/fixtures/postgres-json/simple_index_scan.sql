-- Illustrative query for fixture shape: Index Scan on orders using orders_customer_id_idx.
-- Not guaranteed to reproduce the exact plan without a matching schema/index/dataset.

SELECT o.*
FROM public.orders AS o
WHERE o.customer_id = 42;

-- Illustrative query for fixture shape: Index Scan on orders using orders_customer_id_idx.
-- Not guaranteed to reproduce the exact plan without a matching schema/index/dataset.

SELECT o.*
FROM public.orders AS o
WHERE o.customer_id = 42;

