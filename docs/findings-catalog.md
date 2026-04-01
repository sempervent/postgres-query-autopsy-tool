# Findings Catalog (Initial)

Findings are evidence-based rules emitted by the diagnostic engine.

This page is published as part of the MkDocs documentation site and is the canonical findings catalog.

This file documents the Phase 3 MVP rule catalog, including triggering logic, evidence, and limitations.

## Severity / confidence scales

- Severity: `Info`, `Low`, `Medium`, `High`, `Critical`
- Confidence: `Low`, `Medium`, `High`

## Rule A — `A.row-misestimation`

- Purpose: flag large divergence between estimated and actual rows.
- Trigger: `rowEstimateFactor >= 10` (symmetric; uses \( \max(ratio, 1/ratio) \)).
- Evidence:
  - estimated/actual rows (per-loop and total approx)
  - loops
  - `rowEstimateRatio`, `rowEstimateFactor`, `rowEstimateLog10Error`
  - `subtreeTimeShareOfPlan` when available
- Severity:
  - `>=1000x` → Critical
  - `>=100x` → High
  - `>=10x` → Medium
  - escalates if subtree time share is large
- Confidence: High when actual timing exists; otherwise Medium.
- Limitations: requires ANALYZE actual rows; without it the rule won’t emit.

## Rule B — `B.exclusive-cpu-hotspot`

- Purpose: identify operators doing disproportionate local work.
- Trigger: `exclusiveTimeShareOfPlan >= 0.08` (approx).
- Evidence:
  - `exclusiveTimeMsApprox`, `inclusiveTimeMs`, `exclusiveTimeShareOfPlan`
- Severity scales by share (8%, 15%, 30%, 50%).
- Confidence: High when exclusive time is non-null/non-zero.
- Limitations:
  - exclusive time is approximate: \( \max(0, inclusive - \sum childInclusive) \)

## Rule C — `C.subtree-runtime-hotspot`

- Purpose: prioritize the branch that dominates runtime.
- Trigger: `subtreeTimeShareOfPlan >= 0.35`
- Evidence:
  - `subtreeInclusiveTimeMs`, `subtreeTimeShareOfPlan`
- Limitations: requires actual timing.

## Rule D — `D.buffer-read-hotspot`

- Purpose: identify I/O concentrated in a node/subtree.
- Trigger: node or subtree shared-read share >= 0.35
- Evidence:
  - `sharedReadBlocks`, `subtreeSharedReadBlocks`
  - `sharedReadShareOfPlan`, `subtreeSharedReadShareOfPlan`
  - relation/index names when present
- Limitations: requires BUFFERS shared read fields.

## Rule E — `E.nested-loop-amplification`

- Purpose: flag nested loops with high inner repetition and meaningful inner work.
- Trigger: `Nested Loop` with inner loops >= 10 (uses inner child loops when present).
- Evidence:
  - outer/inner node ids
  - inner loops
  - inner subtree inclusive time and shared-read share (when present)
- Phase 10 propagated evidence:
  - inner-side scan waste anchor (rows removed by filter + approximate removed-share) when available
- Limitations: heuristics depend on child ordering in the JSON plan and available timing/buffers.

## Rule F — `F.seq-scan-concern`

- Purpose: highlight potentially avoidable sequential scans when evidence suggests impact.
- Trigger: `Seq Scan` with either a filter, or strong time/read share.
- Evidence:
  - relation, filter text
  - time/read share signals when available
- Phase 10 evidence:
  - `rowsRemovedByFilter` and approximate removed-share when present
- Limitations: PostgreSQL JSON doesn’t provide “rows scanned” directly; this is intentionally conservative and phrased as investigation guidance.

## Rule G — `G.potential-statistics-issue`

- Purpose: detect patterns of multiple severe misestimations.
- Trigger: at least 2 nodes with `rowEstimateFactor >= 100`
- Evidence: top N severe misestimated nodes and their divergence metrics.
- Limitations: correlation is suggestive, not proof; phrased as “potential”.

## Rule H — `H.plan-complexity`

- Purpose: surface plans that are deep/broad enough to hide compounding problems.
- Trigger: thresholds on node count and/or depth.
- Evidence: node count, depth, most frequent node types.

## Rule I — `I.repeated-expensive-subtree`

- Purpose: flag loops-amplified subtrees with non-trivial inclusive time.
- Trigger: `actualLoops >= 20` and `subtreeInclusiveTimeMs >= 5ms`
- Evidence: loops, subtree time, share.

## Rule J — `J.potential-indexing-opportunity`

- Purpose: conservative “investigate indexing” prompt when evidence is reasonably strong.
- Trigger: Seq Scan with relation+filter + meaningful time/read share.
- Evidence: relation, filter, time/read shares.
- Phase 10 evidence:
  - `rowsRemovedByFilter` and approximate removed-share when present (helps distinguish “scan reads mostly discarded” cases)
- Limitations: does not assert an index is definitely needed.

## Rule K — `K.sort-cost-concern`

- Purpose: flag sort operators that dominate exclusive time, with stronger evidence when external/disk-backed signals appear.
- Trigger: node type contains “Sort” and either exclusive time \(\ge 20ms\) or exclusive time share \(\ge 20\%\), OR explicit external/disk indicators appear.
- Evidence:
  - `sortKey`
  - `sortMethod`, `sortSpaceUsedKb`, `sortSpaceType`, `peakMemoryUsageKb`, `diskUsageKb`, `presortedKey`
  - `exclusiveActualTimeMsApprox`, `exclusiveTimeShareOfPlan`
  - `actualRowsTotal`, `estimatedRowsPerLoop`
- Limitations: does not detect spills directly (JSON plan often omits memory/spill details unless requested).

## Rule L — `L.hash-join-pressure`

- Purpose: highlight hash joins whose subtree dominates runtime, with stronger evidence when batching/disk usage is present.
- Trigger: `Hash Join` with subtree time share \(\ge 30\%\) (or inclusive time \(\ge 30ms\)).
- Evidence:
  - `hashCond`
  - `inclusiveActualTimeMs`, `subtreeTimeShareOfPlan`
  - `actualRowsTotal`, `rowEstimateFactor`
  - hash node detail when available: `hashBuckets`, `originalHashBuckets`, `hashBatches`, `originalHashBatches`, `peakMemoryUsageKb`, `diskUsageKb`
- Limitations: does not prove memory pressure; phrased as investigation guidance.

## Rule M — `M.materialize-loops-concern`

- Purpose: flag materialize nodes in heavily repeated execution zones.
- Trigger: `Materialize` with loops \(\ge 20\) plus meaningful subtree time or I/O share.
- Evidence:
  - `loops`
  - `subtreeTimeShareOfPlan`, `subtreeSharedReadShareOfPlan`
  - `subtreeSharedReadBlocks`
- Limitations: materialization can be beneficial; this rule only triggers when cost signals are non-trivial.

## Rule N — `N.high-fanout-join-warning`

- Purpose: warn when join output diverges strongly from estimates (fan-out / explosion).
- Trigger: join-like node with `rowEstimateFactor >= 10` and non-trivial row counts.
- Evidence:
  - `rowEstimateFactor`, `actualRowsTotal`, `estimatedRowsPerLoop`
  - join predicates (`hashCond`/`mergeCond`/`joinFilter`) when present
- Limitations: fan-out may be real; rule does not claim predicates are wrong—only that impact is high.

## Rule P — `P.append-chunk-bitmap-workload`

- Purpose: distinguish **indexes already in use per chunk** from a naive “missing index” story on TimescaleDB-style plans.
- Trigger: at least one `Append`, many `Bitmap Heap Scan` nodes (≥6), meaningful root shared reads, buffers present.
- Evidence: append/bitmap counts, `rootSharedReadBlocks`, optional `chunkedWorkloadNote` aligned with `PlanIndexOverview`.
- Limitations: does not diagnose chunk pruning or SQL shape—only frames investigation.

## Rule Q — `Q.nl-inner-index-support`

- Purpose: nested loop inner side repeats with **seq scan or bitmap heap** and non-trivial inner subtree cost (index-alignment angle).
- Trigger: `Nested Loop`, inner loops in \[15, 999\], inner access family seq/bitmap, inner time or read share thresholds.
- Evidence: inner/outer ids, loops, filters/index conds, `innerAccessPathFamily`.
- Limitations: complements `E.nested-loop-amplification` (different loop band and framing).

## Rule R — `R.index-access-still-heavy`

- Purpose: **index path exists** (Index Scan, Index Only Scan, or non-chunk-suppressed Bitmap Heap) but reads, heap fetches, or recheck volume remain high.
- Evidence: `accessPathFamily`, relation/index names, `heapFetches`, `rowsRemovedByIndexRecheck`, read/time shares, `isBitmapHeap`.
- Limitations: suppressed for per-chunk bitmap noise when `Append` + many bitmap heaps (see P).

## Rule S — `S.bitmap-recheck-attention`

- Purpose: bitmap heap with **recheck expression or recheck-row removal** worth reviewing (lossy/coarse bitmap narrative).
- Trigger: `Bitmap Heap Scan` with recheck signals and non-trivial heap/read/recheck counts; **not** emitted for each chunk when the P pattern applies.
- Evidence: `recheckCond`, `rowsRemovedByIndexRecheck`, `heapFetches`, read share.
- Limitations: recheck can be normal; phrased as investigation.

### Phase 29 cross-rule notes

- **F** / **J**: seq-scan investigation vs stronger indexing-opportunity wording; evidence now includes `accessPathFamily`.
- **K**: when `sortKey` is present, suggestion and evidence call out **index-aligned ordering** as an investigation angle (`sortOrderIndexInvestigation`, `indexSignal_sortOrderSupport`).
- **E**: evidence includes `innerAccessPathFamily` for compare/UI continuity.

### Phase 30 — Compare index deltas vs findings (F/J/P/Q/R/S)

- **Findings diff** still anchors on `ruleId` + mapped nodes; **index comparison** diffs structured `indexOverview` + `indexInsights` independently.
- When a **Resolved** finding on **F**, **J**, **R**, **S**, or **Q** appears alongside **Resolved** / **Improved** index insight changes, the compare narrative may add a single **corroboration** line (heuristic mapping—not proof).
- **P** (chunked bitmap workload) pairs with compare overview lines and UI copy: indexes may already be in use; **missing index** is not assumed as the only lever.

### Phase 31 — Structured finding ↔ index-diff links

- API exposes **`relatedIndexDiffIndexes`** on each finding diff item and **`relatedFindingDiffIndexes`** on each index insight diff item (array positions, capped).
- UI and markdown reports surface these links compactly; **do not** treat them as DDL prescriptions or guaranteed causal chains.

