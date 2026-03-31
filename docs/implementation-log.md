# Implementation Log

This file tracks the build phases for the Postgres Query Autopsy Tool monorepo.

## Phase 0 — Bootstrap (complete)

State:
- Created monorepo directory structure under `src/`, `tests/`, `docs/`, `ops/`, and `scripts/`.
- Scaffolding started for:
  - Backend: .NET (ASP.NET Core Minimal API) under `src/backend/`.
  - Frontend: React + TypeScript + Vite under `src/frontend/web/`.
- Implemented backend endpoints:
  - `GET /api/health`
  - `GET /api/version`
  - `POST /api/analyze`
  - `POST /api/compare`
  - `POST /api/report/markdown`, `POST /api/report/html`, `POST /api/report/json`
  - `GET /api/analyses`, `GET /api/analyses/{id}` (MVP in-memory store)
- Implemented a minimal frontend:
  - `/` Analyze page (paste JSON + get ranked findings)
  - `/compare` Compare page (placeholder diff summary)
- Added Docker Compose + production-style container builds:
  - Backend container listens on `:8080`
  - Frontend container serves UI and reverse-proxies `/api/*` to the backend

Verification:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docker: `docker compose up --build -d` starts successfully and `/api/health` returns `{ "status": "ok" }`.

Phase 0 status:
- Complete enough to unblock Phase 1 work (real parsing/normalization/metrics).

## Phase 1 — Parsing foundation (in progress)

State:
- Implemented PostgreSQL JSON `EXPLAIN (FORMAT JSON)` parsing + normalization:
  - `IPlanParser`
  - `PostgresJsonExplainParser` producing `NormalizedPlanNode` trees (node type, costs, plan/actual rows, buffers, expressions, children).
- Wired parser into backend `AnalyzeAsync` (still phase-boundary: findings are not yet computed from derived metrics).
- Added parser fixture set and unit tests:
  - seq scan, index scan, nested loop, hash join, aggregate+sort, buffer-heavy, compare fixtures.

Next:
- Add derived metrics engine (Phase 2): inclusive/exclusive time approximation, row divergence ratios, buffer hotspot concentration, etc.
- Expand findings engine (Phase 3): evidence-based ranked findings across the normalized tree.

## Phase 2 — Metrics engine (complete)

Implemented:
- `DerivedMetricsEngine` producing per-node derived metrics (depth/root/leaf, inclusive+exclusive time approximation, row estimate divergence, loops amplification, buffer shares, subtree counts).
- `PlanSummaryBuilder` to compute plan-level summary metrics and limitations.
- `NarrativeGenerator` for evidence-based narrative scaffolding.

Verified:
- Backend unit tests pass for metric calculations on fixtures.

## Phase 3 — Findings engine (in progress)

Implemented:
- Findings framework:
  - `IFindingRule`, `FindingEvaluationContext`, `FindingsEngine`, `FindingRanker`
  - Dedupe by `(ruleId,nodeIds)` and rank based on severity/confidence + impact evidence (time/buffers/misestimation).
- MVP rule catalog (evidence-based, conservative suggestions):
  - A `row-misestimation`
  - B `exclusive-cpu-hotspot`
  - C `subtree-runtime-hotspot`
  - D `buffer-read-hotspot`
  - E `nested-loop-amplification`
  - F `seq-scan-concern`
  - G `potential-statistics-issue`
  - H `plan-complexity`
  - I `repeated-expensive-subtree`
  - J `potential-indexing-opportunity`
- Integrated findings into analyze flow:
  - `/api/analyze` now returns `PlanAnalysisResult` with `nodes`, `summary`, `findings`, and `narrative`.
- Reports updated to include summary + findings (Markdown/HTML/JSON).
- Frontend Analyze page upgraded:
  - findings filtering/search
  - plan tree + node selection
  - node details + associated findings
  - export buttons (md/html/json)

Verified:
- `dotnet test PostgresQueryAutopsyTool.sln` passes.
- Frontend `npm test` and `npm run build` pass.
- `docker compose up --build -d` starts; `/api/analyze` returns non-empty `nodes` and `findings`.

## Phase 6 — Comparison engine + diff UX (in progress)

Implemented:
- `NodeMappingEngine` with:
  - operator family similarity (scan/join/aggregate/sort+materialize/append)
  - weighted scoring with explicit breakdown
  - thresholds that allow common rewrites (Seq Scan → Index Scan) to map with low/medium confidence
- `ComparisonEngine` producing:
  - mapping sets (matches + unmatched)
  - per-node metric deltas
  - top improved / worsened areas
  - findings diff (ruleId + mapped anchor)
  - evidence-based narrative summary
- `/api/compare` upgraded to return `PlanComparisonResultV2` (rich compare object)
- Frontend Compare page upgraded:
  - summary section
  - narrative panel
  - improved/worsened lists (click-to-select)
  - findings diff list (click-to-select where mapped)

Verified:
- `dotnet test PostgresQueryAutopsyTool.sln` passes (includes comparison tests).
- `/api/compare` returns non-placeholder keys: `matches`, `nodeDeltas`, `topImprovedNodes`, `topWorsenedNodes`, `findingsDiff`, `narrative`.
- Frontend `npm test` + `npm run build` pass.

## Phase 7 — Deep compare inspection + matcher diagnostics (complete)

Implemented:
- Rich per-pair inspection payload in compare results:
  - `pairDetails[]` with identity/mapping, raw fields, derived metric deltas + directionality, and per-pair findings view.
- Optional matcher diagnostics (off by default):
  - `POST /api/compare?diagnostics=1` adds `diagnostics` (bounded candidate lists + decision context).
- Compare UI upgraded into an inspectable workstation:
  - side-by-side pair detail panel (metrics + raw fields + per-pair findings)
  - unmatched nodes visibility (A-only / B-only)
  - basic filters + “jump to hottest”
- Added compare report endpoints:
  - `POST /api/compare/report/json`
  - `POST /api/compare/report/markdown`

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docker: `docker compose up --build -d` and `GET /api/health` returns `{ "status": "ok" }`.

## Phase 8 — Hard-case validation + narrative intelligence + type safety + operator depth (in progress)

Implemented:
- Hard-case comparison fixtures under `tests/backend.unit/.../fixtures/comparison/`:
  - join strategy rewrite (Nested Loop → Hash Join)
  - scan rewrites (Seq Scan → Bitmap Heap Scan, Seq Scan → Index Scan)
  - stats improvement (same operators, better estimates)
  - sort rewrite (Sort → Incremental Sort)
  - materialization effect (Materialize introduced under repeated loops)
- Backend unit tests expanded to cover rewrite mapping sanity and narrative structure (substring-level assertions).
- Compare narrative upgraded to be evidence-citing and structured (overall shift, primary drivers, findings changes, investigation guidance).
- Added operator-specific findings rules:
  - `K.sort-cost-concern`
  - `L.hash-join-pressure`
  - `M.materialize-loops-concern`
  - `N.high-fanout-join-warning`
- Diagnostics upgraded to be interpretable:
  - winning factors + rejected candidates with “why lost” hints.
- Frontend compare flow type safety:
  - removed `any` usage for compare payloads; added typed interfaces for pair details, deltas, findings diff, diagnostics.

Verified (current state):
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` passes (22 tests).
- Frontend: `npm test` and `npm run build` pass.

## Phase 9 — Operator Depth v2 (complete)

Implemented:
- Expanded PostgreSQL JSON parsing + normalization for operator-specific fields:
  - Sort: method, space used/type, presorted key, full-sort groups, peak memory, disk usage
  - Hash: buckets/batches (and original), peak memory, disk usage
  - Parallel: workers planned/launched (in addition to parallel-aware)
  - Scan/join nuance: heap fetches, rows removed (filter/join filter/index recheck), TID cond, inner unique, partial mode
  - Memoize/cache: cache key + hits/misses/evictions/overflows (best-effort)
- Pair detail enriched to expose these fields side-by-side in `pairDetails[].rawFields`.
- Diagnostics “why lost” hints enhanced with concrete operator-field differences (sort method / parallel metadata / hash batching when present).
- Findings rules upgraded to incorporate operator evidence:
  - `K.sort-cost-concern`: external/disk sort indicators strengthen severity/confidence and evidence
  - `L.hash-join-pressure`: hash batching/disk signals from child `Hash` node strengthen evidence and suggestions
- Frontend compare selected-pair panel now renders conditional operator-specific sections (Sort/Hash/Parallel/Waste/Cache).
- Added focused fixtures and parser tests to validate normalization:
  - `operator_sort_external.json`
  - `operator_hash_batches_disk.json`
  - `operator_parallel_workers.json`

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` passes (25 tests).
- Frontend: `npm test` and `npm run build` pass.

## Phase 10 — Operator evidence propagation + contextual pair narratives (complete)

Implemented:
- Added a compact, targeted operator-context evidence layer:
  - `OperatorEvidenceCollector` produces `OperatorContextEvidence` per node (bounded subtree inspection).
  - Context evidence surfaces “one level down” signals where humans reason:
    - Hash Join → child `Hash` batching/disk/memory evidence
    - Nested Loop → inner-side loops + scan-waste anchor
    - Sort → input row magnitude + disk-backed indicators
    - Scan waste → rows removed / recheck / heap fetches (local or propagated)
    - Memoize → cache hits/misses and hit-rate
- Analysis pipeline now attaches `contextEvidence` to each `AnalyzedPlanNode`.
- Compare pair details now include `contextEvidenceA`/`contextEvidenceB`, enabling UI to show contextual evidence without clicking into children.
- Upgraded findings evidence to use context where it makes explanations sharper:
  - Nested loop amplification now includes inner-side scan-waste context when present.
  - Seq scan concern + potential indexing opportunity include rows-removed evidence when present.
- Compare narrative now injects short contextual evidence hints (hash batching/disk, scan waste, disk-backed sort) when present.
- Reports upgraded:
  - Analyze Markdown headline findings include short context hints when available.
  - Compare Markdown top pairs include short context hints when available.
- Frontend Compare selected-pair panel adds “Context evidence” sections (hash build + scan waste) rendered conditionally.
- Added fixtures/tests:
  - `operator_memoize_cache.json` + parser test
  - `OperatorEvidenceCollectorTests` to prove child evidence is surfaced on parent operators.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` passes (28 tests).
- Frontend: `npm test` and `npm run build` pass.

## Phase 11 — Context evidence diff summarization + change-focused pair UX (complete)

Implemented:
- Added typed context-diff models + diff builder:
  - `OperatorContextEvidenceDiff` with per-area diffs (hash build, scan waste, sort, memoize, nested loop)
  - explicit directionality (`Improved` / `Worsened` / `Mixed` / etc.)
  - bounded `highlights[]` for UI/narrative/report use
- Pair detail now includes `contextDiff` computed from `contextEvidenceA/B`.
- Compare UI now renders a **Context change summary** section using `contextDiff.highlights`.
- Compare narrative + compare markdown report now prefer `contextDiff` highlights over raw context hints.
- Analyze UI now shows a compact per-node context summary for single-plan inspection.
- Added unit tests for diff summarizer correctness (hash/scan/sort/memoize scenarios).

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` passes (32 tests).
- Frontend: `npm test` and `npm run build` pass.

## Phase 12 — Human-readable node identity + frontend explainability overhaul (complete)

Implemented:
- Added a type-safe presentation layer in the frontend:
  - `presentation/nodeLabels.ts`: deterministic node/pair labels (e.g. `Seq Scan on users`, `Index Scan on orders using ...`)
  - `presentation/contextBadges.ts`: contextDiff-driven badges (e.g. `hash pressure ↑`, `scan waste ↓`)
- Compare page overhaul:
  - improved/worsened rows show human-readable pair labels + confidence + key deltas + 1–3 context badges
  - findings diff rows anchor to readable operator labels (no raw ids)
  - unmatched nodes list shows readable labels instead of raw ids
  - selected pair heading uses readable pair label; raw ids moved to a collapsible debug section
- Analyze page overhaul:
  - findings list shows readable anchor label for the affected node
  - selected node heading no longer leads with raw id; id is in a debug details section
  - plan tree no longer leads with node ids; operator labels drive navigation
- Frontend tests added for presentation logic and leakage guardrails:
  - `nodeLabels.test.ts` covers label generation and badge formatting
  - smoke test asserts no `root.*` ids appear by default on the analyze page

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docker: `docker compose up --build -d` still works.

## Phase 13 — Join/branch naming + branch-aware pair explanation (complete)

Implemented:
- Join/branch-aware labeling in the presentation layer:
  - `joinLabelAndSubtitle()` infers roles with guardrails:
    - Hash Join: `build` (hash child input) vs `probe` (left child)
    - Nested Loop / Merge Join: `outer` (left) vs `inner` (right)
    - condition snippet from `hashCond`/`mergeCond`/`joinFilter` when concise
- Compare UI:
  - join rows now show subtitles like `build: orders • probe: users • cond: ...`
  - selected pair panel shows join subtitle directly under the heading when applicable
- Analyze UI:
  - selected join nodes show branch subtitle under the main label
- Tests:
  - added unit tests for hash join build/probe inference (with `Hash` child) and nested loop outer/inner subtitles.

Verified:
- Frontend: `npm test` and `npm run build` pass.

## Phase 14 — Side-attributed join pain hints + branch-aware contextual badges (complete)

Implemented:
- Frontend side-attribution helper layer:
  - `presentation/joinPainHints.ts` converts structured evidence into **side-attributed** badges and summaries with strict guardrails.
  - Hash Join: uses `contextDiff.hashBuild` as **build-side** evidence → `build pressure ↑/↓` and a “Build side …” summary.
  - Nested Loop: uses `contextDiff.nestedLoop.innerSideWaste` when present as **inner-side** evidence → `inner waste ↑/↓` (fallback: `inner pressure ↑/↓` via amplificationDirection).
  - Analyze mode: uses `contextEvidence.hashJoin.childHash` and `contextEvidence.nestedLoop.innerSideScanWaste` to emit compact side context lines.
- Compare UI:
  - join rows now show side-aware badges when available (fallback to generic context badges when not).
  - selected pair panel includes a “Join side change summary” section when side attribution is supported.
- Backend narrative/evidence:
  - compare evidence lines now include `Build side: ...` / `Inner side: ...` when `ContextDiff` provides explicit side-scoped summaries.

Tests:
- Frontend: added `joinPainHints.test.ts` for side-aware badge + summary behavior and “no fake side hints for non-joins”.
- Backend: added `ComparisonNarrativeSideHintsTests` to assert evidence lines include “Build side” when hash build diff summary exists.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 15 — Narrative and hotspot UX overhaul + query-aware explainability (complete)

Implemented:
- Eliminated raw `root.*` ids from narrative hotspot text:
  - backend `NarrativeGenerator` now formats hotspots using operator/relation-aware labels.
- Analyze page “Narrative” UX overhaul:
  - replaced backend hotspot prose with a structured, clickable “Where to inspect next” list driven by `summary.top*HotspotNodeIds` and presentation labels.
  - each hotspot is clickable and selects the node.
- Optional query text support:
  - `/api/analyze` now accepts optional `queryText`.
  - `PlanAnalysisResult` now includes `queryText` and reports include a “Source Query” section when provided.
  - Analyze page supports an optional SQL textarea and displays the query in a collapsible panel after analysis.

Tests:
- Backend: `NarrativeGeneratorLabelTests` asserts hotspot narrative uses labels (not `root.0`).
- Frontend: `hotspotPresentation.test.ts` asserts hotspot items use readable labels.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 16 — Documentation platform + GitHub Pages + fixture SQL companions (complete)

Implemented:
- MkDocs documentation site:
  - `mkdocs.yml` with RTD theme and Mermaid rendering via plugin.
  - `requirements-docs.txt` for isolated Python docs dependencies.
  - docs IA pages: Home, Getting Started, Architecture (with Mermaid diagrams), Analyze/Compare workflows, Fixtures guide, API/Reports, Contributing, Implementation Log.
- GitHub Pages:
  - `docs.yml` workflow builds and deploys MkDocs `site/` to Pages on `main`.
  - CI (`ci.yml`) now also runs `mkdocs build --strict`.
- Fixture SQL companions:
  - added illustrative `.sql` siblings for `fixtures/postgres-json/*.json`.
  - added `planA.sql`/`planB.sql` for all comparison fixture directories.
  - added fixture hygiene unit tests to enforce companions.
- Developer workflow:
  - Makefile now includes `docs-install`, `docs-serve`, `docs-build`.
  - README includes local docs instructions and points to published docs workflow.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 17 — Docs polish + EXPLAIN capture guidance + graphical Analyze tree view (complete)

Implemented:
- Docs polish:
  - Added `capturing-explain-json.md` with practical `EXPLAIN` command examples and caveats.
  - Updated nav + cross-links from landing and Analyze workflow pages.
  - Added/expanded notes where screenshots belong (kept lightweight to avoid brittle tooling).
- Graphical Analyze plan tree:
  - Added React Flow-based plan graph with stable DAG layout (dagre).
  - Nodes are clickable and stay in sync with hotspot selection and the selected node detail panel.
  - Visual cues: hotspot tint, “hot ex / hot reads / hot subtree” badge, and small evidence chips.
  - Preserved textual tree fallback via a Graph/Text toggle.
- Tests:
  - Added graph adapter unit tests to validate readable labels, edges, and hotspot metadata.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 18 — Analyze graph usability refinements + graph-centered navigation (complete)

Implemented:
- Graph toolbar:
  - Fit-to-view, focus selected, reset view, and a compact legend.
- Graph search + navigation:
  - highlight/dim behavior (no destructive filtering, no re-layout).
  - `prev/next` match navigation selects and focuses matching nodes.
- Subtree collapse/expand:
  - per-node collapse control hides descendants.
  - if selection is hidden by a collapse, selection moves to the collapsed ancestor.
- Visual state improvements:
  - selected vs hotspot vs search match vs dimmed states compose cleanly.
- Tests:
  - added unit tests for collapse visibility and search highlighting logic.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 19 — Analyze graph match list + quick-jump navigation + collapse auto-fit refinement (complete)

Implemented:
- Search match list:
  - graph search now shows a compact clickable list of matches with disambiguating subtitles (parent context + depth).
  - `prev/next` navigation stays in sync with the active match highlight.
- Quick-jump behavior:
  - clicking a match selects and focuses it.
  - if the match is hidden under collapsed ancestors, the graph auto-expands the required path to reveal it.
- Collapse auto-fit refinement:
  - large visibility changes trigger a calm auto-fit (viewport reframe) to reclaim dead whitespace without constant jitter.

Tests:
- Added unit tests for reveal-path expansion and auto-fit decision heuristic.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 20 — Better node disambiguation + shareable node references + repo hygiene (complete)

Implemented:
- Disambiguation improvements:
  - Search match subtitles now prefer the nearest meaningful ancestor boundary (join/aggregate/sort) instead of only parent+depth.
  - Centralized helper for “nearest meaningful ancestor” and node reference formatting.
- Shareable references:
  - Analyze selected node includes a **Copy reference** action that copies a concise human-readable node reference.
  - Compare selected pair includes a **Copy reference** action that copies a concise human-readable pair reference (with join subtitle when available).
  - Lightweight inline “Copied …” feedback.
- Repo hygiene:
  - Added `site/` to `.gitignore` (MkDocs build output).

Tests:
- Added unit tests for nearest-meaningful-ancestor subtitles and share/reference text formatting (no `root.*` leakage in primary labels).

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 21 — Reference-system unification + subtle copy actions for hotspots/findings (complete)

Implemented:
- Reference-system unification:
  - Graph search match-list subtitles now come from the same centralized “nearest meaningful ancestor” logic as copy/share references.
  - Graph nodes carry a precomputed `refSubtitle` derived from the analyzed-plan parent chain (no parallel heuristic in graph state).
  - Added reference helpers for hotspots and findings (node reference + optional short suffix).
- Copy reference UX expansion:
  - Analyze: hotspot rows include a subtle **Copy** action (human-readable node reference, optionally annotated as a hotspot).
  - Analyze: finding rows include a subtle **Copy** action (human-readable node reference, optionally suffixed with finding title).
  - Compare: findings diff rows include a subtle **Copy** action (human-readable node reference with a compact diff context suffix).
  - Reused a lightweight copy-feedback hook for consistent “Copied …” messaging without a global toast framework.

Tests:
- Updated graph adapter/state tests to assert the unified subtitle path (`refSubtitle`) and keep existing search/collapse behavior coverage.
- Expanded `nodeReferences` tests to cover hotspot/finding reference text formatting and avoid raw `root.*` leakage.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 22 — Compare UX truthfulness + compare-page overhaul (complete)

Implemented:
- Truthful Compare onboarding:
  - Removed stale MVP/placeholder language from the Compare page.
  - Added a concise, technical explainer of heuristic mapping, confidence, and what the UI surfaces.
- Compare page structure upgrade:
  - Labeled Plan A / Plan B inputs with “before/after” guidance (without forcing semantics).
  - Added a summary card strip (runtime, shared reads, severe findings, node count, max depth) derived from compare summary.
  - Added coverage phrasing (mapped pairs + unmatched counts) to orient users about mapping completeness.
  - Added a “What changed most” quick-jump section (top worsened + top improved).
  - Consolidated navigation into a clearer “Navigator” area plus findings diff.
  - Strengthened selected pair hierarchy (confidence + depth visible early; debug kept collapsed).
  - Fixed invalid nested-button markup in findings diff rows (row is now a clickable div with keyboard support).
- Presentation-layer helpers:
  - Introduced `presentation/comparePresentation.ts` for intro copy, empty state copy, coverage phrasing, and summary card formatting.

Tests:
- Added Compare UX tests to ensure:
  - stale MVP placeholder copy no longer appears
  - summary/“what changed most” render after a mocked compare run
  - top-change quick-jump updates the selected pair panel

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.


