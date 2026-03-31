-- Illustrative Plan A query for join strategy rewrite fixture.
-- Shape: Nested Loop between users and orders (often driven by a selective users filter + repeated order lookups).
-- Not guaranteed to reproduce exact join strategy without matching schema/indexes/data.

SELECT u.id, o.*
FROM public.users AS u
JOIN public.orders AS o
  ON o.user_id = u.id
WHERE u.status = 'active';

