-- Illustrative query for fixture shape: Hash Join between events and users on (events.user_id = users.id).
-- Not guaranteed to reproduce the exact join strategy without a matching schema/dataset.

SELECT e.*
FROM public.events AS e
JOIN public.users AS u
  ON e.user_id = u.id;

