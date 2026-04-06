# Findings Catalog (Initial)

Findings are evidence-based rules emitted by the diagnostic engine.

This page is published as part of the MkDocs documentation site and is the canonical findings catalog.

This file documents the Phase 3 MVP rule catalog, including triggering logic, evidence, and limitations.

**Phase 32 + Phase 47 note:** findings remain the primary **evidence catalog**. **`OptimizationSuggestion`** objects (returned separately on analyze/compare) **synthesize next steps** from findings, index insights, operator evidence, and (for compare) diffs. A finding says *what fired*; a suggestion says *what to try or measure next*, with explicit cautions and validation steps. **Phase 47** adds presentation-oriented fields (**family**, **recommended next action**, **why it matters**, **target display label**) and **consolidates** overlapping statistics/findings-driven cards when they would repeat the same next step, so the UI stays readable without hiding evidence (expand/detail still shows linked finding text). They are not duplicates of each other.

**Phase 61–64 note:** human-facing narrative (hotspot lists, compare finding deltas, bottleneck cards, story beats) prefers **`PlanNodeReferenceBuilder`** / **`SafePrimary`** labels derived from plan evidence, including richer **join/hash roles** (outer/inner, probe/build) with **Phase 64** shallow-**`Hash`** and dual-**`Hash`** tie-breaks where evidence allows, plus conservative **semi/anti** wording. **`operatorBriefingLine`** on **`AnalyzedPlanNode`** is mirrored onto **`PlanBottleneckInsight`** and compare **`beatBriefing`** so the same voice shows in guide cards and regression beats. Canonical **`nodeId`** values remain the stable join key for UI focus, deep links, and persistence; **Phase 62+** surfaces them only inside collapsed **Technical id** affordances in primary investigative panels. They are not intended as primary user-visible copy when a better operator/relation/role label exists.

**Phase 67 note:** compare **`regionContinuityHint`** and the **rewrite operator-shape** compare suggestion are **heuristic continuity** helpers—they require **medium+** mapping confidence and matching **relation** or **join-table** evidence. They do **not** assert that two operators are logically identical; they flag *same rough plan region, different strategy* so suggestions and story beats can discuss **moved work** vs **renamed nodes**.

**Phase 68 note:** **Seq ↔ index** pairs on the same relation receive a small **mapper score bonus** so they more often clear the **Medium** confidence floor—continuity text is still gated on **relation** agreement and hedged language. **Sort / ordering** continuity additionally requires **conservative overlap** between **sort-key tokens** and **index condition** (or **presorted key**) text; when overlap is weak, the tool falls back to generic scan continuity or omits the ordering-specific sentence.

**Phase 69 note:** Ordering hints prefer **structured column-name** matches on **sort keys** vs **index cond** / **presorted key** when those strings expose identifiable columns; **token-only** matches are labeled **weak** and should be verified against the query. **Bitmap** and **index-only** transitions reuse the same **medium+** confidence gate; **`regionContinuitySummaryCue`** is a **non-authoritative** shorthand derived from the long hint—always read the full **`regionContinuityHint`** when deciding next steps.

**Phase 70 note:** **`continuityKindKey`** and the chip text are derived from **structured continuity** first; regression-style transitions use **outcome = regressed** so the UI does not imply an automatic win. **Query-assisted** ordering uses **ORDER BY** substrings from captured SQL—**not** a full semantic parse. **`continuityKindKey`** is optional and primarily for stable tooling/tests; users should still read **`regionContinuityHint`**.

**Phase 71 note:** **GROUP BY** / **time_bucket** assistance is the same class of **bounded substring heuristics** as **ORDER BY**—it can bridge **surface-different** planner **Group Key** strings or add **bucket-context** wording; it does **not** prove expression equivalence. **Gather-merge vs single aggregate** continuity describes **staging/finalization shape**, not guaranteed cheaper totals.

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

- Purpose: flag **Materialize** and **Memoize** nodes in heavily repeated execution zones (plan-evidence only).
- Trigger: `Materialize` or `Memoize` with loops \(\ge 20\) (memoize uses a slightly higher loop threshold) plus meaningful subtree time or I/O share.
- Evidence:
  - `loops`
  - `subtreeTimeShareOfPlan`, `subtreeSharedReadShareOfPlan`
  - `subtreeSharedReadBlocks`
- Limitations: materialization can be beneficial; this rule only triggers when cost signals are non-trivial.

## Query-shape boundary — `S.query-shape-boundary` (Phase 58)

- Purpose: surface **CTE Scan** / **Subquery Scan** boundaries where row volume or nested-loop repetition suggests **query-shape** cost (not SQL parsing).
- Trigger (any): high `Actual Rows` at the boundary, or **inner-side** scan under **Nested Loop** with high `Actual Loops` combined with medium/large row counts (conservative thresholds).
- Evidence: `nodeType`, `actualRowsTotal` / `Actual Rows`, `Actual Loops`, `underNestedLoopParent`.
- Severity: scales with rows and loops; never claims the CTE “should” be inlined—only that the visible boundary merits investigation.
- Limitations: cannot see SQL text semantics; some boundaries are cheap by design.

## Plan bottleneck summary — `PlanBottleneckInsight` (Phase 58–59)

- **Not a finding rule:** ranked lines in **`PlanSummary.bottlenecks`** consolidate timing, shared-read, severe findings, and (when not redundant) **`S.query-shape-boundary`** into a small cap (≤4) for the UI and narrative orientation.
- **Phase 59 typing:** each row carries **`BottleneckClass`** (e.g. CPU vs I/O vs sort/spill vs join amplification vs scan fan-out vs aggregation vs query-shape boundary vs planner mis-estimation vs access-path mismatch) and **`BottleneckCauseHint`** (**primary focus** vs **downstream symptom** vs **ambiguous**) — conservative, evidence-derived hints, not proven causality.
- **Symptom notes:** optional text when cost may be driven upstream (e.g. nested-loop inner).
- **Compare:** **`BottleneckComparisonBrief`** summarizes how the top bottleneck *classes* and framing differ between plans A and B.
- **Phase 60 propagation:** optional **`propagationNote`** on each insight—short “because → likely” lines (hedged) to hint how pressure may propagate (e.g. sort fed by upstream row volume); not causal proof.

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

## Rule S (bitmap) — `S.bitmap-recheck-attention`

- Purpose: bitmap heap with **recheck expression or recheck-row removal** worth reviewing (lossy/coarse bitmap narrative).
- Note: a different **`S.query-shape-boundary`** rule exists for CTE/subquery scan boundaries (Phase 58); both use an `S.` prefix by convention, not the same signal.
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

