-- Illustrative query for fixture shape: parallel-aware scan with a selective filter.
-- Not guaranteed to reproduce exact workers planned/launched without matching config and dataset.

SELECT *
FROM public.events
WHERE tenant_id = 42;

