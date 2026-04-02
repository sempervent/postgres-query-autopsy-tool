# Compare Workflow

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
- **Next steps after this change** (Phase 32): compact **`compareOptimizationSuggestions`** list (not a verbatim copy of plan B’s analyze suggestions). Suggestion ids use the **`sg_`** prefix (content-hash style). Rows may include **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`** when the engine ties a suggestion to specific diff rows. Rows may offer **Focus pair on node B** when a mapped match exists.
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

The selected pair shows:

- readable pair heading + join branch subtitle (when applicable)
- **Access path / index delta** (Phase 30): bullets from `pairDetails[].indexDeltaCues` when present (human-readable access-path family change + pair-matched index insight diff lines); if cues are empty but families still differ, a single fallback line is shown
- **Related compare next step** (Phase 32): when a `compareOptimizationSuggestion` targets this pair’s plan B `nodeIdB`, show a compact title + summary (does not replace the summary-card suggestion list)
- **Copy reference** (human-readable pair text) and **Copy link** (full URL with `?pair=`, optional `finding=`, `indexDiff=`, `suggestion=` when present) for shareable reopening of the same selection in the Compare UI
- **Join side change summary** when supported (hash build / inner waste)
- context change summary highlights
- raw operator fields and evidence side-by-side

### Findings diff

Diff finding rows include a subtle **Copy** action that copies a concise human-readable reference for the anchored node (optionally annotated with the change type / rule id).

**Interaction model:** the row is a single keyboard-accessible target to select a pair. When both `nodeIdA` and `nodeIdB` are present, that pair is used; when only one side is anchored, the UI **resolves the partner** from the compare `matches` list (`resolveFindingDiffPair`) so diff rows still drive selection and branch context when a mapping exists. **Copy** is a separate button (aligned with Analyze hotspots/findings). When the resolved or explicit pair matches the selected pair, **`aria-pressed`** is true so the navigator, branch strip, and diff stay visually in sync.

Notes:
- Compare is **heuristic**: mapping confidence is shown because some rewrites change structure and labels. Treat low-confidence pairs as leads to validate, not guarantees.

## Stable artifact ids & deep links (Phase 33)

- **Pair**: each **`pairDetails[]`** row has **`pairArtifactId`** (`pair_` + short hash) scoped to **`comparisonId`** and the mapped node ids.
- **Finding diff**: **`findingsDiff.items[].diffId`** (`fd_*`).
- **Index insight diff**: **`indexComparison.insightDiffs[].insightDiffId`** (`ii_*`).
- **URL query keys**: `pair`, `finding`, `indexDiff`, `suggestion` (values are the ids above). The UI syncs these when you change selection/highlights; opening a shared link after running compare with the **same plans** reproduces the same ids so the link lines up with reports.

**Limits:** ids are **deterministic from structured fields** for a given comparison; they are **not** stable across different plan JSON or a different **`comparisonId`**. If query params reference ids that are not in the current result, the UI ignores them for selection.

## Guardrails

Side attribution is intentionally conservative. If evidence is ambiguous, the UI falls back to non-side-specific badges.

