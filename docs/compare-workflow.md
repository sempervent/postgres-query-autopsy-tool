# Compare Workflow

## Input (Phase 36)

1. Paste **Plan A** and **Plan B** as **raw text** (plain JSON or `psql` **`QUERY PLAN`** output—same **`PlanInputNormalizer`** path as Analyze).
2. Optionally expand **Optional: source SQL + EXPLAIN metadata** to attach **`queryTextA` / `queryTextB`**, shared EXPLAIN toggles, per-side **recorded EXPLAIN** commands, and **suggested EXPLAIN** snippets (mirrors Analyze ergonomics). Metadata is **optional** and **client-declared**.
3. Click **Compare** — the API runs analyze twice (with per-side context), then the comparison engine. The full **`PlanComparisonResultV2`** is stored in **SQLite** with **`artifactSchemaVersion`** (Phase 49); the UI syncs **`?comparison=<comparisonId>`** with existing **`pair=`**, **`finding=`**, **`indexDiff=`**, **`suggestion=`** params.
4. **Reopen:** `GET /api/comparisons/{id}` powers **`?comparison=`** loads (same durability rules as analyses). Legacy **`suggestion=`** values may still match via **`alsoKnownAs`** on compare suggestion rows after server normalization—canonical **`suggestionId`** is written back into the URL when the UI syncs.
5. **Copy share link** / **Copy artifact link** in the summary header copies the current URL (includes **`comparison=`** when synced), labeled from **`/api/config`** in auth deployments. **Copy link** on the selected pair also includes **`comparison=`** so deep links stay attached to the stored snapshot. Optional **Sharing** panel when auth is enabled (owner can change scope / groups / link access). **Phase 38:** same identity modes as Analyze (**JWT** / **API key** / legacy bearer / proxy); **`authHelp`** from **`/api/config`** summarizes the active mode.

After a run, open **Plan capture / EXPLAIN context (A vs B)** for a compact two-column view: source query present/absent, **planner costs** (from JSON), **input normalization** line, declared options, and recorded command per side.

## Visual hierarchy (Phase 43) + Phase 55 polish

Compare uses the same **`pqat-*`** styling as Analyze: capture card, summary **metric tiles**, navigator and pair **workspace** panels, and a dashed **customizer** well. **Phase 55** adds the same **state banners** for reopen/load/errors, a **comparing** info banner during POST, **intro** top accent strip, and **summary shell** glow/border tuning. Intro copy sits in a structured overview card. Behavior, URL params, and layout persistence are unchanged.

## Patterns & delivery (Phase 44)

**Optional: source SQL + EXPLAIN metadata** and **Advanced** (matcher diagnostics) use the same **`pqat-textarea`**, **`pqat-fieldLabel`**, and **`pqat-details`** patterns as Analyze. Navigator pair rows, findings-diff cards, and summary **index / suggestions** callouts use shared **`workstation-patterns.css`** classes (instead of ad hoc inline layout). The **Compare** route is **lazy-loaded** with a **Loading Compare…** shell; **Customize workspace** loads **DnD** reorder UI on first open, matching Analyze.

## List performance (Phase 45)

When **findings diff** has many rows, **`CompareNavigatorPanel`** wraps the list in **`VirtualizedListColumn`** (same helper as Analyze) so scrolling stays light. Small diffs keep a non-virtual list; **ClickableRow** selection, copy, and index-cross-link buttons behave the same.

## Selected-pair progressive detail (Phase 46)

See **Selected pair panel** below: **`CompareSelectedPairHeavySections`** is code-split and loaded after the eager header/actions so the pair column stays responsive on large comparisons.

## Pair heavy prefetch (Phase 48)

**`prefetchCompareSelectedPairHeavySections()`** warms the same lazy chunk as **`CompareSelectedPairPanel`**’s **`Suspense`** boundary. It is **coalesced** (one in-flight dynamic `import`) and triggered when:

- the user **hovers** or **focuses** primary pair-selection **`ClickableRow`** targets (navigator worsened/improved, findings diff rows, **What changed most**, **Branch context** mapped rows),
- the user hovers/focuses **Focus plan B** on a compare suggestion in the summary column,
- the browser is **idle** shortly after a comparison result is shown (**`requestIdleCallback`**, **`setTimeout`** fallback)—same pattern as Analyze graph prefetch.

This reduces perceived delay when moving quickly between pairs without blocking the first paint of the pair column header.

## Compare workspace layout (Phase 41 + Phase 42)

The Compare page mirrors Analyze’s **workstation** model:

- **Customize workspace** (inside the capture card): presets (**Balanced**, **Wide pair** / wide-graph emphasis, **Review**, **Diff-heavy**, **Compact**), per-panel visibility toggles, **drag handle + Up/Down** reorder for **summary-column sections** and **navigator blocks** (worsened/improved, findings diff, unmatched), and **Swap main columns** (navigator vs pair detail). **Reset to defaults** restores the balanced preset.
- **Responsive layout**: same **three tiers** as Analyze (**narrow** &lt;900px, **medium** 900–1319px, **wide** ≥1320px). **Medium** and **wide** keep the **summary + “what changed most”** row and **navigator | pair** main grid **side-by-side** with tuned **`minmax`/`fr` ratios**; only **narrow** stacks to a single column. Summary **metric cards** use an **`auto-fit`** grid so five cards wrap on mid-width screens instead of forcing one cramped row.
- **Persistence**: layout is stored under **`pqat.compareWorkspaceLayout.v1`** in **localStorage**. When auth is enabled and the SPA has credentials (**`VITE_AUTH_*`**), the same JSON syncs to **`PUT /api/me/preferences/compare_workspace_v1`** (debounced), matching the Analyze preference pattern.
- **Hidden inputs**: if **Plan inputs** is toggled off, a dashed **recovery strip** offers **Show plan inputs** so Compare remains usable.
- **Semantics**: hiding a panel does not clear **selection** or **URL params**—restore panels from Customize to see branch strip, findings diff, or pair detail again. Reordering uses stable region ids; **`coerceCompare*`** merge helpers reject corrupted orders.

## What compare does (and does not)

- **Does**: heuristically maps nodes between Plan A and Plan B, computes deltas, summarizes context diffs, and highlights findings changes.
- **Does not**: prove mathematical identity of nodes. Low-confidence matches are leads, not guarantees.

## Confidence

Mapping confidence is emitted per pair. Treat low-confidence pairs as “suspects” until validated by nearby structure and evidence.

## Reading the compare UI

### At the top: summary + “what changed most”

After a compare run, start at the top:

- **Summary cards**: total runtime, shared reads, severe findings, node count, max depth (Plan B value + delta vs Plan A).
- **Index changes** (Phase 30+31, Phase 33 ids): plan-level scan-mix deltas, chunked-bitmap posture lines when applicable, and a short list of **bounded index insight diffs**. Each insight row can show **Supported by N finding change(s)** with rule tails and a **Highlight finding** control. Cross-links use **stable ids** (`fd_*` / `ii_*`) in **`relatedFindingDiffIds`** / **`relatedIndexDiffIds`**; legacy **`relatedFindingDiffIndexes`** / **`relatedIndexDiffIndexes`** remain for backward compatibility but are not the primary reference.
- **Next steps after this change** (Phase 32 + Phase 47): compact **`compareOptimizationSuggestions`** list (not a verbatim copy of plan B’s analyze suggestions). Suggestions use the same **human-readable fields** as analyze (**`suggestionFamily`**, **`recommendedNextAction`**, **`whyItMatters`**, **`targetDisplayLabel`**) and compare-specific wording (“after this change”, plan B + diff context). Suggestion ids use the **`sg_`** prefix (content-hash style). **Phase 48:** suggestions **carried** from plan B’s high-priority analyze list use ids derived from **structured fields + source `sg_*` id** (not the prefixed display title). **Phase 49:** persisted rows may include **`alsoKnownAs`** (e.g. legacy carried-id forms) so **`suggestion=`** deep links keep working; the SPA resolves aliases to the canonical id for highlight + URL sync. Rows may include **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`** when the engine ties a suggestion to specific diff rows. Rows may offer **Focus plan B · …** when a mapped match exists (label prefers **`targetDisplayLabel`**). Server read path normalizes older suggestion JSON; the client keeps a thin display fallback.
- **Findings ↔ index deltas** (Phase 31+33): finding diff rows can show **Related index change** with **stable id** buttons (and legacy **Index Δ #k** when needed). Outlining uses **`ii_*`** targets so highlights survive reordering. The selected pair panel adds **Finding ↔ index corroboration** when structured links exist on that mapped pair. Links are **heuristic** (node ids, relation evidence, rule id ↔ `signalKinds` alignment)—not proof of causality.
- **What changed most**: quick-jump to the top worsened and top improved mapped pairs.

### Navigator: improved / worsened lists + “what changed most”

These surfaces share the same interaction model as Analyze hotspots/findings and the findings diff:

- Each row is a **`ClickableRow`** (role=`button`, `Enter`/`Space` activates selection). Inner **Copy** is a real `<button>` with `stopPropagation`, so copy never toggles selection.
- **`aria-pressed`** reflects whether the row’s mapped pair is the **currently selected** pair. Selected rows get a restrained accent treatment (tint in the navigator; a left accent bar on tinted “what changed most” callouts so severity coloring stays readable).
- **Copy pair reference** on navigator and top-change rows copies the same style of human-readable pair reference as the selected-pair panel (via `pairReferenceText`), with local “Copied …” feedback in the navigator column.

Each row uses human-readable pair labels and may include badges:

- generic context badges (hash pressure, scan waste, sort spill, memoize, nested loop)
- **side-aware join badges** when the evidence is explicitly side-scoped (build side / inner side)
- optional **`index Δ`** chip when the mapped pair has non-empty **index delta cues** (access-path family change and/or pair-scoped index insight diff summaries)

### Branch context (twin path strip)

Above **Selected node pair**, the **Branch context** section is the visual counterpart to the navigator:

- Two columns (**Plan A** / **Plan B**) show the **path from root to the selected node** on each side, using the same `nodeShortLabel` system as the rest of the app (no raw internal ids in primary labels).
- The **focal** row (current selection) uses **`aria-pressed`** and the same selected styling as other `ClickableRow` targets.
- **Mapped** ancestors and children are **clickable**: choosing a row selects the **mapped pair** `(nodeIdA, nodeIdB)` from the compare `matches` table, so the navigator, findings diff, detail panel, and branch strip stay aligned.
- Rows without a mapping partner render as static rows tagged **unmapped**; nodes that appear in the unmatched id lists show a small **A-only** / **B-only** chip.
- **Compact cues** under the heading summarize the focal pair (e.g. confidence, time/read deltas from `nodeDeltas`, operator-family shift, first context-diff highlight, severe finding hits on that pair, join-side hints when present).
- **Downstream**: immediate children of the focal node on each side (capped for density), with the same mapping / unmatched semantics.

### Selected pair panel

**Phase 46 — staged hydration:** the panel paints **immediately** with the pair heading, **Copy reference** / **Copy link**, optional subtitle, **Related compare next step** (when present), and the **confidence · score · depth** line. Denser blocks load in a **second lazy chunk** behind a calm skeleton (**`pqat-pairHeavySkeleton`**) so selection still feels instant while metrics and evidence hydrate.

The selected pair shows (after load):

- readable pair heading + join branch subtitle (when applicable) — **eager**
- **Related compare next step** (Phase 32 + Phase 47) — **eager** when a `compareOptimizationSuggestion` targets this pair’s plan B `nodeIdB` (title, summary, **Next ·**, **Why ·** when present)
- **Copy reference** and **Copy link** (full URL with **`comparison=`**, `?pair=`, optional `finding=`, `indexDiff=`, `suggestion=`) — **eager**
- **Access path / index delta** (Phase 30): bullets from `pairDetails[].indexDeltaCues` when present; fallback line when families differ — **deferred**
- **Finding ↔ index corroboration** cues — **deferred**
- **Join side change summary** when supported (hash build / inner waste) — **deferred**
- context change summary highlights — **deferred**
- raw operator fields and evidence side-by-side, **Key metric deltas**, **Findings for this pair**, optional matcher diagnostics — **deferred**

### Findings diff

Diff finding rows include a subtle **Copy** action that copies a concise human-readable reference for the anchored node (optionally annotated with the change type / rule id).

**Interaction model:** the row is a single keyboard-accessible target to select a pair. When both `nodeIdA` and `nodeIdB` are present, that pair is used; when only one side is anchored, the UI **resolves the partner** from the compare `matches` list (`resolveFindingDiffPair`) so diff rows still drive selection and branch context when a mapping exists. **Copy** is a separate button (aligned with Analyze hotspots/findings). When the resolved or explicit pair matches the selected pair, **`aria-pressed`** is true so the navigator, branch strip, and diff stay visually in sync.

Notes:
- Compare is **heuristic**: mapping confidence is shown because some rewrites change structure and labels. Treat low-confidence pairs as leads to validate, not guarantees.

## Stable artifact ids & deep links (Phase 33 + 36)

- **Comparison**: **`comparisonId`** identifies the **persisted** snapshot; URL key **`comparison`** (with **`pair`**, **`finding`**, **`indexDiff`**, **`suggestion`**).
- **Pair**: each **`pairDetails[]`** row has **`pairArtifactId`** (`pair_` + short hash) scoped to **`comparisonId`** and the mapped node ids.
- **Finding diff**: **`findingsDiff.items[].diffId`** (`fd_*`).
- **Index insight diff**: **`indexComparison.insightDiffs[].insightDiffId`** (`ii_*`).

**Limits:** artifact ids are **deterministic from structured fields** for a given comparison payload; they are **not** stable across different plan JSON or a different **`comparisonId`**. If query params reference ids that are not in the current result, the UI ignores them for selection. **`comparison=`** must match a row still present in SQLite (TTL / pruning / DB deletion ⇒ 404-style error in the UI).

## Guardrails

Side attribution is intentionally conservative. If evidence is ambiguous, the UI falls back to non-side-specific badges.

