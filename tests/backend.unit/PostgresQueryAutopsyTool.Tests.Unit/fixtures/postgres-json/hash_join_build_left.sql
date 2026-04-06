-- Synthetic fixture companion: mirrors a Hash Join where the Hash (build) subtree is the *left* plan child.
-- PostgreSQL usually places Hash on the right; this file documents intent for unit tests only.

SELECT e.*
FROM public.events AS e
JOIN public.users AS u
  ON e.user_id = u.id;
