# In-app example plans (Phase 108–109)

JSON files under `plans/` are **bundled** into the SPA via Vite **`?raw`** imports. They are **copies** of selected `e2e/fixtures/*.json` so Playwright and Vitest stay aligned.

| Bundled file | E2E fixture source (when copied) |
|--------------|----------------------------------|
| `simple-seq-scan.json` | `simple_seq_scan.json` |
| `sort-pressure-shipments.json` | `rewrite_sort_seq_shipments.json` |
| `index-ordered-shipments.json` | `rewrite_index_ordered_shipments.json` |
| `nl-join-inner-heavy.json` | `nl_inner_seq_heavy.json` |
| `compare-before-seq-scan.json` / `compare-after-index-scan.json` | `compare_before_seq_scan.json` / `compare_after_index_scan.json` |
| `compare-bitmap-access-plan-a.json` / `compare-index-scan-plan-b.json` | `rewrite_access_bitmap_shipments.json` / `rewrite_access_idx_shipments.json` |

When you change an E2E fixture that backs an example, update the matching file here (or replace the example id) and adjust **`analyzePlanExamples.ts`** / **`comparePlanExamples.ts`** labels if the story changes.
