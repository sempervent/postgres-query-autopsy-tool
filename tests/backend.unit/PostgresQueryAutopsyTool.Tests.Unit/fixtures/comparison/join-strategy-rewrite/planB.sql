-- Illustrative Plan B query for join strategy rewrite fixture.
-- Shape: Hash Join on the same predicate (users.id = orders.user_id), with orders filtered by recent time.
-- Not guaranteed to reproduce exact join strategy without matching schema/stats/data.

SELECT u.id, o.*
FROM public.users AS u
JOIN public.orders AS o
  ON o.user_id = u.id
WHERE u.status = 'active'
  AND o.created_at > now() - interval '30 days';

