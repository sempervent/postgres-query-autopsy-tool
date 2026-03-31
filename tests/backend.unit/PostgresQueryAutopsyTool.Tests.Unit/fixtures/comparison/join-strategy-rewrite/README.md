## Join strategy rewrite: Nested Loop → Hash Join

**Intent**
- Stress operator-family mapping in the same structural zone.
- Validate that the engine can map a `Nested Loop` in A to a `Hash Join` in B (join-family rewrite).
- Ensure deltas + narrative can cite the rewrite and the main cost signals (time/reads).

**Shape**
- Same logical join condition (`users.id = orders.user_id`).
- Same base relations (`users`, `orders`), different join strategy.

