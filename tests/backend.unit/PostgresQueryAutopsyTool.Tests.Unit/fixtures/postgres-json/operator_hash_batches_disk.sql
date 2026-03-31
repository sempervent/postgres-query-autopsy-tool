-- Illustrative query for fixture shape: hash join whose build side hashes in multiple batches and spills to disk.
-- Plan relations are "a" and "b" (aliases).

SELECT *
FROM public.b AS b
JOIN public.a AS a
  ON a.id = b.a_id;

