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

