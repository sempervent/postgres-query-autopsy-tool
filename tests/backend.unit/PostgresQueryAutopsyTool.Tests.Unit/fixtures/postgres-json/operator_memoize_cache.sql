-- Illustrative query for fixture shape: Memoize caching repeated index lookups (nested-loop-ish access pattern).
-- The fixture uses "$0" parameters; this sample shows a correlated join.

SELECT *
FROM public.events AS e
JOIN public.t AS t
  ON t.id = e.t_id;

