-- Illustrative query for fixture shape: external/disk-backed sort.
-- Relation name is "t" in the plan; alias is used accordingly.

SELECT *
FROM public.t AS t
ORDER BY t.created_at DESC;

