# Comparison model (Phase 6)

This tool compares **analyzed plans**, not raw JSON plans:

`plan JSON` → normalize → derive metrics → findings → **compare**

## Node mapping is heuristic

There is no stable node identifier across two different EXPLAIN outputs, especially after rewrites (indexes, join strategy, sort variants).
So we compute a **best-effort mapping** with a **confidence** level:

- **High**: near-exact match (same operator type, same relation/index context, similar shape/depth)
- **Medium**: plausible rewrite (e.g. scan family rewrite) with strong contextual consistency
- **Low**: weak match that may still help navigation; treat cautiously

If no match crosses the minimum threshold, the node is left **unmatched**.

## Operator families

We treat these operator families as “near” so common rewrites can match:

- **Scan family**
  - Seq Scan, Index Scan, Index Only Scan, Bitmap Heap Scan, Bitmap Index Scan, Tid Scan, Subquery Scan
- **Join family**
  - Nested Loop, Hash Join, Merge Join
- **Aggregate family**
  - any operator containing “Aggregate”
- **Sort/materialization family**
  - Sort, Incremental Sort, Materialize, Memoize
- **Append family**
  - Append, Merge Append

Family similarity does **not** imply equivalence — it only reduces the chance of false “unrelated” decisions.

## Scoring signals (weighted)

The matcher scores candidate pairs in \([0,1]\) by combining:
- exact node type match
- operator family match
- relation name match
- index name match
- join type match
- depth proximity
- shape similarity (child count + subtree size)
- predicate presence similarity (filter/index-cond)

This is intentionally readable and tunable.

## Pair detail model (Phase 7+)

For each mapped node pair, the compare result includes a `pairDetails[]` entry that contains:
- identity/mapping: node ids, node types, relation/index/join type, depths, confidence, match score, score breakdown, coarse **access path families** (`accessPathFamilyA` / `accessPathFamilyB`, Phase 29+)
- raw operator fields (best-effort when available): filter/index cond/join filter/hash/merge cond/sort key/group key/strategy/parallel-aware
- derived metrics side-by-side with deltas and directionality (time, reads, buffer share, estimate divergence, loops, subtree size)
- per-pair findings view: findings on A, findings on B, and diff items related to the pair
- **index delta cues** (Phase 30): compact strings derived from plan-level index comparison + pair mapping (`indexDeltaCues`)

## Plan-level index comparison (Phase 30)

`IndexComparisonAnalyzer` diffs `indexOverview` and bounded `indexInsights` between the two analyzed plans:

- **Overview lines**: evidence-based count deltas (seq / index / bitmap operators) and chunked-bitmap posture transitions.
- **Insight diffs**: matched using mapped node ids first, then structured fingerprints (`signalKinds` + relation + index + access-path family), then soft relation + signal overlap. Each item is classified as `New`, `Resolved`, `Improved`, `Worsened`, `Changed`, or `Unchanged`—without comparing free-form `headline` text for equality.

The compare **narrative** adds a conservative index/access-path paragraph. When **`FindingIndexDiffLinker`** produces structured overlaps, **`LinkedNarrativeLines`** may add one or two corroboration sentences (e.g. resolved seq-scan / indexing finding ↔ resolved or improved missing-index-style index delta); otherwise a generic overlap line may still appear.

### Finding ↔ index cross-links (Phase 31)

- **`FindingIndexDiffLinker.Apply`** runs after `DiffFindings` + `IndexComparisonAnalyzer.Analyze`, before pair details and narrative.
- **Matching (conservative):** mapped node overlap (`nodeIdA`/`nodeIdB`) and/or **relation** alignment from finding **evidence** (`relationName`, `primaryRelationName`) vs insight `relationName`; plus **rule ↔ signal** alignment (e.g. F/J ↔ `missingIndexInvestigation`, R ↔ `indexPathStillCostly`, S ↔ `bitmapRecheckOrHeapHeavy`, K ↔ `sortOrderSupportOpportunity`, Q ↔ `joinInnerIndexSupport`). **P.append-chunk-bitmap-workload** uses plan-level chunked heuristic + bitmap/index-heavy index diffs without requiring the same node id.
- **Payload:** at most **four** reciprocal indexes per item; no duplicated embedded objects.
- **Limitation:** indexes refer to **ranked** `findingsDiff.items` and the current `insightDiffs` array order—stable for a given compare response, not a permanent id across sessions.

## Operator-specific pair detail (Phase 9)

When PostgreSQL provides them, pair details include operator-specific fields side-by-side (A/B) such as:
- sort: method, space used/type, disk usage, presorted key
- hash: buckets/batches (and original values), memory usage, disk usage
- parallel: workers planned/launched
- waste signals: rows removed by filter/join filter/index recheck, heap fetches
- cache/memoize: cache key + hit/miss/eviction/overflow counters

The UI renders these as conditional sections to avoid noisy empty panels.

## Propagated/context evidence (Phase 10)

Some critical evidence is often attached to nearby descendants (e.g. `Hash` under `Hash Join`).
To reduce “click one level down” friction, each analyzed node includes compact `contextEvidence`
and each pair detail includes `contextEvidenceA`/`contextEvidenceB`.

Examples:
- `Hash Join` pair shows child hash batching/disk/memory evidence directly.
- parent hotspots can surface scan-waste anchors (rows removed by filter/recheck) from the nearby subtree.

Guardrails:
- bounded subtree inspection (depth + node count caps)
- curated models (no raw node dumps)
- only surfaced when materially present (non-null / non-zero)

## Context evidence diffs (Phase 11)

To avoid forcing users to “do the subtraction,” each pair detail can include a structured `contextDiff`
computed from `contextEvidenceA/B`.

`contextDiff` includes:
- typed diffs for key context areas (hash build pressure, scan waste, sort spill-ish signals, memoize effectiveness, nested loop amplification)
- directionality per area and an overall direction
- bounded `highlights[]` strings suitable for UI/narrative/report summaries (not essays)

Guardrails:
- explicit typed logic (no free-form AI summaries)
- percentages only when meaningful
- absent/null when not applicable for the node/pair

## Diagnostics mode (optional)

Diagnostics are **off by default** to avoid flooding normal payloads. Enable via:
- `POST /api/compare?diagnostics=1`

Diagnostics include:
- top candidate matches considered per A node
- the selected winner (when matched)
- **winning factors** (top score breakdown contributors)
- **rejected candidates** with bounded “why lost” hints (e.g. weaker relation/depth/type similarity, one-to-one constraint)
- when present, short concrete hints based on operator-specific metadata (sort method, parallel worker metadata, hash batching)

These diagnostics are intended for debugging odd mappings and improving heuristics; they are not a proof of identity.

## Delta semantics

For each matched node pair we compute deltas for:
- inclusive time (ms)
- exclusive time approx (ms)
- subtree time share
- shared read blocks and share
- row estimate factor
- actual rows total
- loops

Directionality:
- Lower **time** is better (improved)
- Lower **shared reads** is better (improved)
- Lower **row estimate factor** is better (improved)
- Loops are ambiguous; we treat them as evidence, not a goal by themselves

## Narrative generation strategy (Phase 8)

The comparison narrative is generated from actual comparison data and is structured as:
1. overall shift (runtime + shared reads when present)
2. primary regression / primary improvement (top pairs) with evidence (node types, relation when available, time/read deltas, match confidence)
3. notable findings changes (new/worsened + resolved)
4. investigation guidance and explicit uncertainty notes

When confidence is low, the narrative uses hedged language (“appears to”, “likely”) and avoids overclaiming.

## Limitations

- Mapping is greedy, not optimal bipartite matching.
- Node type rewrites can still confuse mapping when relation names are missing (CTEs/subqueries).
- Findings diff currently anchors each finding to its first node id (MVP); multi-node findings may need richer anchoring.
- Diagnostics are bounded snapshots of candidate scoring; they do not capture every “rejected” pair in large plans.

