-- Illustrative parallel scan: worker buffer lines may appear under a parent "Workers" array
-- when the leader node omits per-node buffer totals. JSON fixture exercises parser merge behavior.

SELECT * FROM public.events e WHERE e.tenant_id = 42;
