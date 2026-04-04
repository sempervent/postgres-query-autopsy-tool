# Visual regression (optional, Phase 51–55)

**Phase 55** refreshed the workstation look (state banners, summary deck, typography). Baselines taken *before* that work are obsolete; new snapshots should prefer **post–Phase 55** Analyze/Compare “happy path” + one **access denied** frame if you add visual coverage.

No screenshot baselines are committed yet. When adding visual checks:

- Prefer a **dedicated** Playwright project (e.g. `visual`) with low **parallelism** and stable viewport.
- Store baselines under something like `e2e/visual/snapshots/` and review diffs in PRs.
- Keep the default **`testing`** profile suite fast and non-visual unless you explicitly opt in.
