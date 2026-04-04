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

## Phase 23 — Analyze interaction cleanup + frontend/backend parity audit (complete)

Implemented:
- Valid interactive markup on Analyze:
  - Replaced nested `button` patterns in **hotspots** and **findings** rows with `ClickableRow` (role=`button`, keyboard activation) plus inner `ReferenceCopyButton`.
- Shared components:
  - `components/ClickableRow.tsx` — row-level navigation without nesting buttons.
  - `components/ReferenceCopyButton.tsx` — consistent small copy affordance with `aria-label`.
- Compare alignment:
  - Findings diff rows now use the same `ClickableRow` + `ReferenceCopyButton` pattern (replacing ad-hoc div markup).
- Parity / polish:
  - Analyze summary line now includes **severe findings count** from `PlanSummary.severeFindingsCount` next to nodes/depth/timing/buffers.
- Test infrastructure:
  - `ResizeObserver` stub in `test/setup.ts` for React Flow in tests.
- Styling: `.clickableRow:focus-visible` for keyboard focus ring in `index.css`.

Tests:
- `AnalyzePage.interaction.test.tsx`: no nested `button` elements after analysis; Copy triggers clipboard write; finding row remains queryable by accessible name.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npm test` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 24 — Compare navigator interaction unification + selected-state polish (complete)

Implemented:
- Compare navigator parity:
  - **Worsened / improved** list rows and **“what changed most”** callouts use `ClickableRow` + `ReferenceCopyButton` (same family as findings diff and Analyze).
  - **Selected state**: matching rows use `aria-pressed` and shared selected styling; top callouts use `selectedEmphasis="accent-bar"` so red/green tints remain visible.
  - **Selection sync**: findings diff rows set `selected` when both node ids match the active pair.
- `ClickableRow`: optional `selectedEmphasis` (`fill` default, `accent-bar` for tinted surfaces).
- Navigator column: copy-feedback hook for top-of-column “Copied …” messaging on navigator/top-change copies.

Tests:
- `ComparePage.ux.test.tsx`: no nested `button` elements; default selection + improved click sync `aria-pressed` on worsened/improved and findings diff; navigator Copy does not change selection; keyboard `Enter` activates row selection.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npx vitest run` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 25 — Compare visual branch mapping + workstation finalization (complete)

Implemented:
- **Branch context strip** (`CompareBranchStrip` + `compareBranchContext.ts`): side-by-side path from root to the selected node on Plan A and B, plus immediate children; human-readable labels via `nodeShortLabel`; focal row uses `ClickableRow` + `aria-pressed` consistent with the navigator.
- **Selection sync**: clicking a mapped row in the strip calls `setSelectedPair` with the pair from `matches`; navigator, findings diff, detail panel, and strip share `effectivePair`.
- **Findings diff parity**: `resolveFindingDiffPair` fills a missing side from `matches` so single-anchored diff items still select a pair and update the strip when possible.
- **Visual semantics**: **A-only** / **B-only** chips for unmatched nodes in context; **unmapped** label when a path node has no partner; compact cue chips (confidence, deltas, operator shift, context highlight, severe findings on pair, join-side hints).
- **IA**: branch context sits directly above **Selected node pair** in the right column; intro/empty-state copy mentions the branch strip.

Tests:
- `compareBranchContext.test.ts`: match lookup, finding resolution, view model labels (no `root` id in primary path labels), focal partner wiring.
- `ComparePage.ux.test.tsx`: branch region + twin path headers; ancestor click in strip changes selection; B-only finding resolves pair; existing tests scoped to avoid duplicate text queries.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` passes.
- Frontend: `npx vitest run` and `npm run build` pass.
- Docs: `mkdocs build --strict` passes.
- Docker: `docker compose up --build -d` and `/api/health` pass.

## Phase 26 — PostgreSQL BUFFERS JSON parsing + detection (complete)

Implemented:
- **Parser** (`PostgresJsonExplainParser`): reads buffer counters from nested `Buffers` **or** flat per-node keys (PostgreSQL default). Sums matching keys across `Workers` when the plan node omits that counter (parallel plans).
- **Detection** (`PlanBufferStats`): `hasBuffers` / findings context use any shared, local, or temp buffer field (null = absent; zero still counts).
- **Plan summary + narrative**: aligned with new detection; narrative distinguishes “counters present but no read hotspot list” vs “no counters detected”.
- **Frontend**: `bufferFieldsPresentation.ts` + **Buffer I/O** block on Analyze selected node; clearer empty-state copy for hotspot lists.

Tests:
- Fixtures `pg_flat_buffers_seq_scan.json`, `pg_workers_flat_buffers.json` (+ SQL companions).
- Parser, `PlanBufferStats`, findings/summary integration, frontend unit tests.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — 43 passed.
- Frontend: `npx vitest run` — 37 passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET /api/health` OK.

## Phase 27 — Typed worker stats + parallel-plan UI (complete)

Implemented:
- **Domain**: `PlanWorkerStats` on `NormalizedPlanNode.Workers`; `PlanWorkerStatsHelper` for ranges and conservative unevenness/temp I/O checks.
- **Parser**: `PostgresJsonExplainParser` fills typed `Workers` from JSON while keeping existing parent merge when leader omits buffer counters (no double-count in summaries).
- **Narrative**: mentions parallel per-worker stats when present; optional line when shared reads are clearly uneven across workers.
- **API**: camelCase JSON includes `node.workers` on analyzed nodes (System.Text.Json on `PlanAnalysisResult`).
- **Frontend**: `workerPresentation.ts` (summary cue + table rows); Analyze **Selected node** shows worker summary line and **Workers** grid next to Buffer I/O.
- **Tests**: parser/fixtures (`pg_workers_flat_buffers`), helper tests, findings/narrative integration, `workerPresentation.test.ts`, `AnalyzePage.interaction.test.tsx` (with/without workers).

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — 47 passed.
- Frontend: `npx vitest run` — 45 passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET /api/health` OK.

**Limitation (by design):** worker-aware narrative and UI cues are display- and conservative-threshold oriented; deeper worker-skew analysis is not a separate rules catalog yet.

## Phase 28 — `complex_timescaledb_query` fixture integration (complete)

Implemented:
- **Fixture classification**: large TimescaleDB-style plan with flat buffer keys, temp I/O, Gather Merge, partial/finalize aggregates, nested `Workers` (buffers + sort spill fields), external merge sort, Append + many bitmap heap/index scans over chunks.
- **Parser regression** (`PostgresJsonExplainParserTests`): root/gather merge buffers, partial-aggregate worker rows vs parent totals, sort worker sort-space fields, Append + bitmap scan counts; shared `Descendants()` helper (file-local) for tree queries.
- **Analysis regression** (`FindingsEngineTests`): `hasBuffers`, non-empty read hotspots, buffer-read finding, narrative does not claim bufferless plan, `PlanWorkerStatsHelper` read/temp ranges on real partial-aggregate workers, parallel narrative cue.
- **Frontend**: `workerPresentation.test.ts` regression case aligned to fixture worker read pair.
- **Docs**: `docs/fixtures.md` section for `complex_timescaledb_query`; SQL companion header explains illustrative vs JSON source of truth.
- **Hygiene**: existing `FixtureSqlCompanionTests` already requires `complex_timescaledb_query.sql` next to `.json` (no change required).

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — 49 passed.
- Frontend: `npx vitest run` — 46 passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` OK.

## Phase 29 — Index opportunity analysis + index-usage explainability (complete)

Implemented:
- **`IndexSignalAnalyzer`** + `PlanIndexOverview` / `PlanIndexInsight` on `PlanAnalysisResult` (camelCase JSON): bounded node insights (missing-index angle, costly index/bitmap, sort order hint, NL inner support) with **suppression** of per-chunk bitmap spam when Append + many bitmap heaps (Timescale pattern).
- **Findings**: **P** append/chunk bitmap workload, **Q** nested-loop inner index support, **R** index path still heavy, **S** bitmap recheck attention (IDs chosen to avoid collision with existing **L** hash-join and **M** materialize rules).
- **Rule polish**: F/J evidence `accessPathFamily`; K sort suggestion + evidence for index-order investigation; E evidence `innerAccessPathFamily`.
- **Compare groundwork**: `NodePairIdentity.AccessPathFamilyA/B`; Compare selected-pair **access path change** cue; full analyses carry `indexOverview`/`indexInsights` for future diffs.
- **Analyze UI**: plan **Index posture** line; findings legend; selected-node **Access path / index insight** cards; `indexInsightPresentation.ts` + tests.
- **Fixtures + tests**: `index_scan_heap_heavy`, `bitmap_recheck_waste`, `nl_inner_seq_index_support` (+ SQL); `IndexAnalysisTests` + `complex_timescaledb_query` regression (P fires; S and per-chunk R suppressed; sort insights present).

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — 54 passed.
- Frontend: `npx vitest run` — 51 passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` OK.

**Limitations:** index insights do not rank like findings; no automatic index DDL. Compare-mode index diffs were added in Phase 30 (below).

## Phase 30 — Compare-mode index deltas + index-aware narrative (complete)

Implemented:
- **`IndexComparisonAnalyzer`** + **`IndexComparisonSummary`** / **`IndexInsightDiffItem`**: plan-level `indexOverview` diff lines; bounded **`indexInsights`** diff with **`New` / `Resolved` / `Improved` / `Worsened` / `Changed` / `Unchanged`** via mapped-node match, fingerprint (`signalKinds` + relation + index + family), then soft relation+signal overlap; stress proxy comparison on matched facts when fingerprints match.
- **`PlanComparisonResultV2.IndexComparison`**; **`NodePairDetail.IndexDeltaCues`** for selected-pair UI; **`ComparisonEngine` narrative** adds access-path family count, overview/insight bullets, chunked-bitmap nuance, and optional findings/index corroboration line.
- **Compare markdown report**: “Index comparison” section.
- **Web**: **Index changes** summary block; navigator **`index Δ`** chip; **Access path / index delta** panel; `buildCompareIndexSectionModel` + `formatIndexInsightDiffKind` for numeric enum; intro bullet for index diffs.
- **Tests**: `IndexComparisonAnalyzerTests` (seq→index fixtures + **`complex_timescaledb_query` vs `simple_seq_scan`**); `ComparisonEngineTests` / `ComparisonHardCaseTests` build real `indexOverview`/`indexInsights`; frontend `indexInsightPresentation.test.ts` + extended `ComparePage.ux.test.tsx`.
- **Docs**: `compare-workflow`, `api-and-reports`, `comparison-model`, `fixtures`, `architecture`, `findings-catalog`.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **57** passed.
- Frontend: `npx vitest run` — **49** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** Phase 31 changed compare JSON: `indexComparison.insightDiffs[].kind` is a lowercase string (`new`, `resolved`, …). Insight matching remains heuristic when node mapping is weak; unchanged-insight pairs may still carry verbose “unchanged” summaries internally (filtered from primary UI lists).

## Phase 31 — Compare findings ↔ index-delta cross-linking + enum polish (complete)

Implemented:
- **`FindingIndexDiffLinker`**: reciprocal **`RelatedIndexDiffIndexes`** / **`RelatedFindingDiffIndexes`** on **`FindingDiffItem`** / **`IndexInsightDiffItem`** (capped at 4); conservative matching via nodes, relation evidence, rule id ↔ **`signalKinds`**; special case for **P.append-chunk-bitmap-workload** vs chunked/bitmap-heavy index diffs.
- **`NodePairDetail.CorroborationCues`**: pair-scoped corroboration lines when linked items share the mapped pair.
- **`IndexInsightDiffKindJsonConverter`**: JSON strings **`new`**, **`resolved`**, **`improved`**, **`worsened`**, **`changed`**, **`unchanged`** (enum attribute on type).
- **Narrative / markdown**: **`LinkedNarrativeLines`** when structured links yield explanatory sentences; compare markdown lists related finding/index indices on key rows.
- **Web**: findings diff **Related index change** + **Index Δ #n**; index section **Supported by** + **Highlight finding**; highlights outline linked rows; selected-pair **Finding ↔ index corroboration**; **`compareIndexLinks.ts`** helpers; **`formatIndexInsightDiffKind`** accepts lowercase API strings.
- **Tests**: **`FindingIndexDiffLinkerTests`** (links + JSON + narrative helper); frontend **`compareIndexLinks.test.ts`**, extended **`ComparePage.ux.test.tsx`** and **`indexInsightPresentation.test.ts`**.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **60** passed.
- Frontend: `npx vitest run` — **53** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** link indices are positions in the current response payload, not durable ids; some findings or index diffs may have no links when overlap rules do not fire.

## Phase 32 — Actionable optimization suggestions engine (complete)

Implemented:
- **Models**: `OptimizationSuggestion`, `OptimizationSuggestionCategory`, `SuggestedActionType`, `SuggestionConfidenceLevel`, `SuggestionPriorityLevel` on `PlanAnalysisResult.optimizationSuggestions`; JSON string enums via `Serialization/OptimizationSuggestionEnumConverters.cs`.
- **Engines**: `OptimizationSuggestionEngine` (analyze: findings + index insights + operator evidence + worker skew + temp/sort spill; suppresses naive seq-scan/J index bullets under chunked **P** posture); `CompareOptimizationSuggestionEngine` → `PlanComparisonResultV2.compareOptimizationSuggestions`.
- **Reports**: analyze markdown/HTML **Optimization suggestions**; compare markdown **Next steps after this change (compare)**.
- **Web**: Analyze **Optimization suggestions** cards (top 5, pills, validate line, node jump, expandable rationale/cautions); selected-node **Related optimization suggestion**; Compare **Next steps after this change** + pair-scoped **Related compare next step**; `optimizationSuggestionsPresentation.ts` + tests.
- **Tests**: `OptimizationSuggestionEngineTests` (seq scan, hash join, sort spill, stats, index heavy, NL inner, **complex_timescaledb_query** non-naive guardrail); `CompareOptimizationSuggestionEngineTests`; frontend `AnalyzePage.interaction.test.tsx` + `ComparePage.ux.test.tsx` + presentation test.
- **Docs**: `analyze-workflow`, `compare-workflow`, `findings-catalog`, `fixtures`, `architecture`, `api-and-reports`.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **68** passed.
- Frontend: `npm test` (vitest `--run`) — **57** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** suggestions remain heuristics; compare “carry” items reuse plan B titles and may overlap thematically with the compact list. `suggestionId` is a stable content hash for dedupe, not a cross-session durable key.

## Phase 33 — Stable artifact IDs + deep-linkable references (complete)

Implemented:
- **Backend**: `CompareArtifactIds` (`fd_*`, `ii_*`, `pair_*`) assigned in `ComparisonEngine`; `FindingDiffItem` / `IndexInsightDiffItem` carry **`diffId`** / **`insightDiffId`** and **`relatedIndexDiffIds`** / **`relatedFindingDiffIds`** (legacy index arrays retained); `NodePairDetail.pairArtifactId`; `FindingIndexDiffLinker` fills id arrays; `OptimizationSuggestion` / compare engine use **`sg_*`** `suggestionId` with optional **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`**; markdown reports bracket **`[fd_*]`**, **`[ii_*]`**, **`[sg_*]`**, pair refs where useful.
- **Frontend**: `api/types.ts` aligned; **`presentation/artifactLinks.ts`** (query keys, deep-link builders, `scrollArtifactIntoView`); Compare **`?pair=`**, **`?finding=`**, **`?indexDiff=`**, **`?suggestion=`** sync + one-time highlight hydrate per `comparisonId`; Analyze **`?node=`** hydrate once per `analysisId`; **`data-artifact`** on rows; **Copy link** beside reference copy on selected pair / Analyze node; related navigation prefers stable ids.
- **Tests**: `CompareArtifactIdsTests`, linker/report/assertion updates; `artifactLinks.test.ts`; Compare/Analyze UX tests with `MemoryRouter` deep links and `afterEach(cleanup)` where needed.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **71** passed.
- Frontend: `npm test` (vitest `--run`) — **60** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** artifact ids are **deterministic within a given comparison/analysis payload** (scoped by `comparisonId` / structured identity); swapping plan A↔B or re-running analyze produces a new id namespace. Analyze URL behavior for `?node=` was extended in **Phase 34** (continuous sync). Weak node mapping still limits cross-panel focus for some suggestions.

## Phase 34 — EXPLAIN capture metadata + optional costs + Analyze URL sync (complete)

Implemented:
- **Backend**: `ExplainOptions` / `ExplainCaptureMetadata` on analyze request & `PlanAnalysisResult`; `PlannerCostPresence` + `PlannerCostAnalyzer` → `PlanSummary.PlannerCosts`; extra summary **warnings** when costs are absent or mixed; `PlanAnalysisService` markdown/HTML **Plan capture & EXPLAIN context**; `AnalyzeRequestDto.explainMetadata`.
- **Frontend**: `PlanSummary.plannerCosts`, types; **Suggested EXPLAIN command** (toggles + optional recorded command + copy); **Send EXPLAIN options** checkbox; **Plan source / EXPLAIN metadata** panel; continuous **`?node=`** sync (deduped) + URL→selection on back/forward; `onAnalyze` prefers valid `?node=` when present; **`presentation/explainCommandBuilder.ts`** / **`explainMetadataPresentation.ts`**; `analyzePlanWithQuery` optional third argument.
- **Tests**: `PlannerCostAnalyzerTests`, `ExplainCaptureMetadataTests`; `explainCommandBuilder.test.ts`, `explainMetadataPresentation.test.ts`; Analyze interaction tests (metadata panel, suggested EXPLAIN copy, deep link + **Copy link**); `afterEach(cleanup)` on Analyze UX tests.
- **Docs**: `capturing-explain-json.md`, `analyze-workflow.md`, `api-and-reports.md`, `architecture.md`.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **78** passed.
- Frontend: `npm test` (vitest `--run`) — **68** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** declared `explainMetadata` is **client-supplied truth** (not verified against JSON). `PlannerCosts` is **structural detection** only. Compare flow does not accept explain metadata per plan (analyze-only scope for this phase).

## Phase 35 — Persisted analyses + pasted-plan normalization (complete)

Implemented:
- **Core**: `PlanInputNormalizer` / `PlanInputNormalizeResult` / `PlanInputNormalizationInfo` (`rawJson` vs `queryPlanTable`); conservative stripping of **`QUERY PLAN`** tables, separators, **`(N rows)`**, **`|`** cell borders, **`+`** line continuations; structured errors with hints.
- **API**: `POST /api/analyze` accepts **`planText`** (preferred) or legacy **`plan`**; **400** `plan_parse_failed` on normalize/parse failure; **`planInputNormalization`** on result when `planText` path used; existing in-memory store + **`GET /api/analyses/{id}`**; `InternalsVisibleTo` + **`WebApplicationFactory`** integration tests.
- **Frontend**: `analyzePlanWithQuery(planText, …)`, `getAnalysis`, `PlanParseError` / `AnalysisNotFoundError`; Analyze sends raw textarea; **`?analysis=`** load + skip redundant fetch when id matches in-memory result; URL sync **`analysis` + `node`**; **Copy share link** (summary + selected node); normalization status line; `PlanAnalysisResult.planInputNormalization` in types.
- **Tests**: `PlanInputNormalizerTests` (incl. QUERY PLAN + `+` fixture); `AnalyzeApiIntegrationTests` (persist round-trip, 404, QUERY PLAN persistence + `queryPlanTable`); `artifactLinks.test.ts`; Analyze interaction tests (share link params, `getAnalysis`, bad id, normalization label, `PlanParseError` UI).
- **Docs**: `capturing-explain-json.md`, `analyze-workflow.md`, `api-and-reports.md`, `architecture.md`.

Verified:
- Backend: `dotnet test PostgresQueryAutopsyTool.sln` — **87** passed.
- Frontend: `npm test` (vitest `--run`) — **73** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK (see command log in this phase).
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}` (see command log in this phase).

**Limitations:** storage was **in-process only** in Phase 35; Phase 36 replaces this with SQLite (see below). `+` continuation handling can be ambiguous vs JSON string content at line ends. `explainMetadata` remains client-declared.

## Phase 36 — Durable storage + Compare capture metadata parity (complete)

Implemented:
- **Persistence**: `IArtifactPersistenceStore`, `SqliteArtifactStore` (`Api/Persistence/`), JSON serialization aligned with API (`ArtifactPersistenceJson`); tables for analyses and comparisons; **`created_utc`**, optional **`expires_utc`**, **`last_access_utc`**; configurable **`Storage:DatabasePath`**, **`ArtifactTtlHours`**, **`MaxArtifactRows`**; purge on read + startup retention pass.
- **API**: `POST /api/analyze` and `POST /api/compare` persist full result payloads after success; **`GET /api/analyses/{id}`** and **`GET /api/comparisons/{id}`** load from SQLite; compare request DTO: **`planAText`/`planBText`**, **`queryTextA`/`queryTextB`**, **`explainMetadataA`/`explainMetadataB`** (legacy **`planA`/`planB`** unchanged); **`plan_parse_failed`** with **`side`** when a compare half fails to parse.
- **Core / services**: `PlanAnalysisService.CompareAsync` applies per-side normalization + metadata before `ComparisonEngine`; **`PlanCaptureMarkdownFormatter`** includes per-side capture sections in compare markdown.
- **Frontend**: `getComparison`, `compareWithPlanTexts`, Compare **`?comparison=`** reopen, **Plan capture / EXPLAIN context** (A vs B), suggested EXPLAIN for both sides, share links including **`comparison=`**; Analyze copy text notes SQLite durability.
- **Ops**: Dockerfile `data` dir + env; `docker-compose` volume **`pqat-api-data:/app/data`**.
- **Tests**: `DurableStorageIntegrationTests` (restart simulation via new factory + same DB path); compare metadata round-trip; frontend Compare/Analyze tests and `artifactLinks` expectations.
- **Docs**: `analyze-workflow`, `compare-workflow`, `capturing-explain-json`, `api-and-reports`, `architecture`, this log.

Verified (this phase):
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **89** passed.
- Frontend: `npm test` (vitest `--run`) — **75** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK.
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** durability is **the SQLite file on disk** (or container volume); deleting it or aggressive TTL/pruning drops share ids. **No authentication** — treat **`analysis=`** / **`comparison=`** as capability URLs. **`explainMetadata`** is still **client-declared** and not cryptographically tied to JSON. Multi-instance deployments need a **shared** DB path or external store (not in scope).

## Phase 37 — Optional auth, groups, and scoped sharing (complete)

Implemented:
- **Core**: `StoredArtifactAccess`, `ArtifactAccessScope` (`link` / `private` / `group` / `public`); optional **`artifactAccess`** on `PlanAnalysisResult` / compare payloads (merged from DB on read, stripped from stored JSON body).
- **API**: `AuthOptions` + `AuthIdentityMiddleware` (**`ProxyHeaders`**, **`BearerSubject`**); `ArtifactAccessEvaluator` for read + manage-sharing; SQLite migration + `SqliteArtifactStore` ACL columns; **`GET /api/config`**; **`GET /api/analyses/{id}`** / **`GET /api/comparisons/{id}`** enforce **`CanRead`** when auth enabled; **`PUT …/sharing`**; `ProgramAuthHelpers` JSON responses for TestServer compatibility; integration tests (`ArtifactAuthIntegrationTests`, isolated temp DB per factory).
- **Frontend**: `fetchAppConfig`, `AccessDeniedError`, auth headers; **`shareArtifactLinkLabel`** / **`copyArtifactShareToast`**; **`ArtifactSharingPanel`**; Analyze + Compare load config, access-denied handling, copy wording; **`updateAnalysisSharing`** / **`updateComparisonSharing`**.
- **Docs**: `deployment-auth.md`, `api-and-reports.md`, `architecture.md`, `analyze-workflow.md`, `compare-workflow.md`, `index.md`, `mkdocs.yml` nav.

Verified (this phase):
- Backend: `DOTNET_ROLL_FORWARD=LatestMajor dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **93** passed.
- Frontend: `npx vitest run` — **79** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` not run in this environment (missing `mermaid2` plugin locally); nav and new page added for CI/docs hosts with plugins installed.

**Limitations:** **`BearerSubject`** mode uses the **raw bearer token string** as the stored user id (no JWT parsing). Groups come from **`X-PQAT-Groups`** in both proxy and bearer modes—no org admin UI. SQLite ACLs are local to the API’s DB file. **Phase 38** adds **`JwtBearer`** and **`ApiKey`** so new deployments can avoid raw-token owners (see below).

## Phase 38 — Real auth identity (JWT + API keys) + hardening (complete)

Implemented:
- **Identity**: **`AuthMode.JwtBearer`** — HS256 JWT validation (`Auth:Jwt`: issuer, audience, signing key, **`SubjectClaim`**, **`GroupsClaimNames`**); **`AuthMode.ApiKey`** — **`SqliteApiKeyPrincipalStore`** + **`api_key_principal`** table (SHA-256 key hashes, optional **`Auth:ApiKey:Seeds`**); **`UserIdentity`** carries **`AuthIdentitySource`** + optional **`DisplayName`**; **`JwtBearerIdentityValidator`** clears default JWT claim-type maps so **`sub`** round-trips.
- **Abstraction**: **`IRequestIdentityAccessor`** / **`HttpRequestIdentityAccessor`**; **`AuthIdentityMiddleware`** returns **401** for invalid JWT / bad API key when credentials are presented.
- **Startup**: **`AuthConfigurationValidator`** requires JWT signing material when **`JwtBearer`** is enabled.
- **Rate limiting**: optional **`RateLimiting:Enabled`** + fixed window on **`POST /api/analyze`** / **`POST /api/compare`** (**429** `rate_limit_exceeded`).
- **API**: **`GET /api/config`** adds **`authIdentityKind`**, **`authHelp`**, **`rateLimitingEnabled`**.
- **Frontend**: **`AppConfig`** extended; **`authHeaders`** prefers **`VITE_AUTH_API_KEY`** then **`VITE_AUTH_BEARER_TOKEN`**; **`ArtifactSharingPanel`** shows **`authHelp`** + mode-aware env hints.
- **Tests**: **`JwtAuthIntegrationTests`**, **`ApiKeyAuthIntegrationTests`**, **`AuthConfigurationValidatorTests`**; existing **`ArtifactAuthIntegrationTests`** (legacy bearer) unchanged.
- **Docs**: `deployment-auth.md`, `api-and-reports.md`, `architecture.md`, `analyze-workflow.md`, `compare-workflow.md`, `contributing.md` (mermaid2 / venv), this log.

Verified (this phase):
- Backend: `dotnet test PostgresQueryAutopsyTool.sln --configuration Release` — **101** passed.
- Frontend: `npx vitest run` — **79** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK (with `pip install -r requirements-docs.txt` in `.venv-docs`).
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** JWT support is **symmetric HS256** in-process (no JWKS/OIDC discovery in this phase). API keys are **hashed** but still high-entropy secrets in transit—use TLS. **Remote SQLite backup** is operational (file copy / volume snapshot), not a built-in export API. Legacy **`BearerSubject`** rows remain incompatible with **`sub`**-based JWT owners without migration.

## Phase 39 — Analyze workspace layout + graph/narrative integration (complete)

Implemented:
- **Frontend / `AnalyzePage`**: Investigation-style **workspace** — after summary/metadata, a **plan workspace** grid: **graph column** (toggles, searches, `AnalyzePlanGraph` or text tree) + **`aside` Plan guide** on **`min-width: 1080px`** (`useAnalyzeWorkspaceWide` with JSDOM-safe `matchMedia`); narrow screens stack the rail under the graph. Rail: **selection snapshot** (label, subtitle, metric preview, top-finding cue), line-clamped **What happened**, **Where to inspect next** (hotspots), **Top findings** preview, **Next steps** (suggestion preview + **Focus**), optional **Source query** in `<details>`. **Lower band**: full **Findings** | **Optimization suggestions** + **Selected node**; removed duplicate bottom narrative block; **Workers**, raw JSON, derived metrics, **operator context** behind `<details>` for progressive disclosure.
- **`AnalyzePlanGraph`**: Optional **`graphHeight`** (default `clamp(360px, 48vh, 620px)`), **`minHeight`** 320 — less dead space under small plans.
- **Tests**: `AnalyzePage.interaction.test.tsx` — disambiguate duplicate rail/main copy via **`getByRole('button', { name: 'Finding: …' })`**, **`within`…Optimization suggestions**, **Focus** button name matches full node label; workers test opens **Parallel workers** `<details>` before asserting grid.
- **Docs**: `analyze-workflow.md`, `index.md`, `architecture.md`, this log.

Verified (this phase):
- Backend: `dotnet build PostgresQueryAutopsyTool.sln -c Release` + `dotnet test PostgresQueryAutopsyTool.sln -c Release --no-build` — **101** passed.
- Frontend: `npx vitest run` — **79** passed; `npm run build` OK.
- Docs: `mkdocs build --strict` OK (`.venv-docs` + `requirements-docs.txt`).
- Docker: `docker compose up --build -d`; `GET http://localhost:8080/api/health` returns `{"status":"ok"}`.

**Limitations:** Breakpoint is a single width threshold (no tablet-specific tuning). The rail is intentionally dense on large plans—users with very long narratives still scroll within clamped sections. Compare page layout unchanged in this phase.

## Phase 40 — Analyze page decomposition + customizable workspace layout (complete)

Implemented:
- **Frontend architecture**: Major regions extracted to `src/frontend/web/src/components/analyze/` — **`AnalyzeCapturePanel`**, **`AnalyzeSummaryCard`**, **`AnalyzePlanWorkspacePanel`** (+ **`AnalyzePlanTextTree`**), **`AnalyzePlanGuideRail`**, **`AnalyzeFindingsPanel`**, **`AnalyzeOptimizationSuggestionsPanel`**, **`AnalyzeSelectedNodePanel`**, **`AnalyzeWorkspaceCustomizer`**; shared chrome in **`analyzePanelChrome.ts`**; **`useAnalyzeWorkspaceWide`** → `hooks/`; **`compactMetricsPreview`** → `presentation/`.
- **Layout model**: **`analyzeWorkspace/analyzeWorkspaceModel.ts`** — `AnalyzeWorkspaceRegionId`, `AnalyzeGuideSectionId`, `AnalyzeLowerBandColumnId`, `AnalyzeWorkspaceLayoutState` (v1), presets **balanced** / **focus** / **detail**, **`mergeAnalyzeWorkspaceLayout`** for storage evolution.
- **Persistence**: **`analyzeWorkspaceStorage.ts`** (localStorage key **`pqat.analyzeWorkspaceLayout.v1`**); **`useAnalyzeWorkspaceLayout`** debounced server sync via **`fetchUserPreference` / `saveUserPreference`** (`ANALYZE_WORKSPACE_PREFERENCE_KEY`) when **`authEnabled`** and **`hasAuthFetchCredentials()`**; **`authHeaders.ts`** exposes **`hasAuthFetchCredentials`**.
- **Backend**: **`IUserPreferenceStore`**, **`SqliteUserPreferenceStore`**, table **`user_preference`**; **`GET` / `PUT /api/me/preferences/{key}`** (404 when auth disabled; 401 without identity when auth on). **`UserPreferencePutDto`** in **`Program.cs`**.
- **Tests**: **`analyzeWorkspaceModel.test.ts`**; **`UserPreferencesApiTests.cs`** (API key factory); **`AnalyzePage.interaction.test.tsx`** clears stored layout key in **`beforeEach`**; worker smoke test timeout relaxed for parallel vitest load.
- **Docs**: `analyze-workflow.md`, `architecture.md`, `index.md`, `api-and-reports.md`, this log.

Verified (this phase):
- Frontend: `npx vitest run` — **82** tests in **19** files (includes `analyzeWorkspaceModel.test.ts`); `npm run build` / `tsc -b` OK.
- Backend: project **builds** (`dotnet build` net8.0); **`dotnet test`** not executed in the agent environment (host had .NET 10 SDK without net8 runtime); run **`dotnet test PostgresQueryAutopsyTool.sln -c Release`** locally or in CI with .NET 8.
- Docs: `mkdocs build --strict` expected OK where `.venv-docs` + plugins are installed.

**Limitations:** No drag-and-drop (Up/Down reorder only). **Compare** does not use the layout hook yet—only Analyze. Server preferences require **auth enabled** + valid identity; misconfigured clients keep **local-only** behavior.

## Phase 41 — Compare workspace decomposition + customizable layout parity (complete)

Implemented:
- **Frontend decomposition**: `src/frontend/web/src/components/compare/` — **`CompareIntroPanel`**, **`CompareCapturePanel`** (+ **`CompareWorkspaceCustomizer`**), **`CompareSummaryColumn`**, **`CompareTopChangesPanel`**, **`CompareNavigatorPanel`**, **`ComparePairColumn`**, **`CompareSelectedPairPanel`**, **`CompareCaptureContextColumn`**; **`ComparePage.tsx`** (~676 lines) orchestrates state, deep-link sync, and layout.
- **Layout model**: **`compareWorkspace/compareWorkspaceModel.ts`** (v1 visibility, **`summarySectionOrder`**, **`leftStackOrder`**, **`mainColumnOrder`**, presets); **`compareWorkspaceStorage.ts`** (`pqat.compareWorkspaceLayout.v1`); **`useCompareWorkspaceLayout`** + **`COMPARE_WORKSPACE_PREFERENCE_KEY`** (`compare_workspace_v1`) aligned with **`/api/me/preferences/{key}`**.
- **Shared primitive**: **`workspaceLayout/reorder.ts`** (`swapWithNeighbor`) reused from Analyze’s hook.
- **UX**: Intro / input recovery strip; responsive summary + top-changes row; wide vs stacked main columns (`useAnalyzeWorkspaceWide`); empty navigator message when all list panels hidden; empty pair column message when branch + pair detail hidden.
- **Tests**: **`compareWorkspace/compareWorkspaceModel.test.ts`**; **`ComparePage.ux.test.tsx`** clears compare layout localStorage in **`beforeEach`**, adds customize/hide findings diff round-trip.
- **Docs**: `compare-workflow.md`, `architecture.md`, `index.md`, `api-and-reports.md`, this log.

Verified (this phase):
- Frontend: `npx vitest run` — **88** tests in **20** files; `npm run build` / `tsc -b` OK.
- Backend: **`dotnet test`** not runnable in agent environment (host .NET 10 without .NET 8 runtime); run **`dotnet test PostgresQueryAutopsyTool.sln -c Release`** in CI or with .NET 8 installed.
- Docs: `mkdocs build --strict` where `.venv-docs` + plugins are installed.

**Limitations:** Still no drag-and-drop reorder. Server sync for Compare matches Analyze (auth + credentials required). Compact preset keeps three **`leftStackOrder`** entries so merge round-trips; **unmatched** remains ordered last but can stay hidden via visibility.

## Phase 42 — Full-width workspace density + responsive breakpoint refinement + drag/reorder polish (complete)

Implemented:
- **Layout tiers**: **`useWorkspaceLayoutTier`** — **`narrow`** &lt;900px, **`medium`** 900–1319px, **`wide`** ≥1320px; used by **`AnalyzePage`** and **`ComparePage`** for graph+guide, summary+top-changes, and main compare columns (medium keeps side-by-side grids instead of a single 1080px cliff).
- **Shell width**: **`App.css`** **`.content`** — fluid width with **`max-width: min(2200px, 100%)`** and clamp padding (removes fixed ~1126px centered column).
- **Analyze / Compare models**: presets **Wide graph**, **Reviewer**, **Compact** (Analyze); **Wide pair** (`wideGraph`) (Compare); exported **`coerceAnalyzeGuideSectionOrder`**, **`coerceAnalyzeLowerBandOrder`**, **`coerceCompareSummarySectionOrder`**, **`coerceCompareLeftStackOrder`** for validated merges; hooks expose **`setGuideSectionOrder`**, **`setLowerBandOrder`**, **`setSummarySectionOrder`**, **`setLeftStackOrder`**.
- **Reorder UX**: **`components/workspace/WorkspaceSortableOrderList`** — **@dnd-kit** vertical sortable list, **drag handle** + **Up/Down**; wired in **`AnalyzeWorkspaceCustomizer`** and **`CompareWorkspaceCustomizer`**.
- **Compare summary cards**: **`CompareSummaryColumn`** metric grid uses **`repeat(auto-fit, minmax(...))`** for wrapping on mid-width viewports.
- **Tests**: **`useWorkspaceLayoutTier.test.tsx`**; extended **`analyzeWorkspaceModel` / `compareWorkspaceModel`** tests; **`AnalyzePage.interaction`** and **`ComparePage.ux`** assert **Down** reorder persists to **localStorage**.
- **Docs**: **`analyze-workflow.md`**, **`compare-workflow.md`**, **`architecture.md`**, **`index.md`**, **`api-and-reports.md`**, this log.

Verified (this phase):
- Frontend: `cd src/frontend/web && npx vitest run` — **101** passed (**21** files); `npm run build` OK.
- Docs: `mkdocs build --strict` — run in this phase (see command output).
- Docker: `docker compose build` + `docker compose up -d`; `curl http://localhost:8080/api/health` → `{"status":"ok"}`.
- Backend: **no backend code changed in Phase 42**. **`dotnet build PostgresQueryAutopsyTool.sln -c Release`** succeeded; **`dotnet test`** **could not execute** on this host (testhost targets **net8.0** but only **.NET 10** runtime is installed — same limitation as Phase 41). Run **`dotnet test PostgresQueryAutopsyTool.sln -c Release`** in CI or after installing the **.NET 8** runtime.

**Limitations:** Drag reorder is **vertical lists inside Customize** only (not freeform page layout). **Auth preference sync** still requires auth enabled + SPA credentials. Ultra-wide layouts cap at **`max-width`** on **`.content`**; very narrow viewports still stack aggressively by design.

## Phase 43 — Visual design polish + cohesive workstation aesthetics (complete)

Implemented:
- **Design tokens** (`index.css`): layered **`--surface-*`** (workspace, rail, detail, capture, tool, list, suggestion, graph, metric), **`--text-secondary`** / **`--text-tertiary`**, **`--border-subtle`**, **`--elev-1`** / **`--elev-2`**, **`--focus-ring`**, refined dark/light accent and body contrast; **`#root`** full-bleed (removes legacy 1126px centered column).
- **Workstation stylesheet** (`workstation.css`): **`pqat-page`**, **`pqat-panel`** variants, **`pqat-btn`** / **`pqat-seg`**, **`pqat-input`** / **`pqat-textarea`**, **`pqat-chip`** + severity tints, **`pqat-metricTile`**, **`pqat-customizer`** (dashed tool well), **`pqat-graphFrame`** + React Flow control theming, **`pqat-listRow`**, **`pqat-copyBtn`**.
- **Shell** (`App.css`): glassy **topBar**, **pill nav** with **`navLink--active`**; **`App.tsx`** uses **`NavLink`** + imports **`workstation.css`**.
- **Analyze / Compare UI**: capture/summary/workspace/findings/suggestions/selected-node panels, graph toolbar, guide rail eyebrow, Compare intro + capture header (**Plan inputs**), navigator/pair columns, summary metric tiles, customizer + sortable rows aligned to the same system.
- **Tests**: **`App.smoke.test.tsx`** — compare route + active nav via **`aria-current`**; full suite **102** tests.
- **Docs**: **`architecture.md`** — Phase 43 paragraph in the numbered phase list plus Analyze/Compare bullets updated for **`workstation.css`** / **`pqat-*`**.

Verified (this phase):
- Frontend: `npx vitest run` — **102** passed (**21** files); `npm run build` OK.
- Docs: `mkdocs build --strict` OK (`.venv-docs`).
- Docker: `docker compose build` OK (web image rebuilds frontend; api cached).
- Backend: **no backend changes**; **`dotnet test`** not run on this host (**.NET 8** runtime not installed; same as Phase 42).

**Limitations:** Many secondary textareas/buttons inside Compare optional **details** still use lighter inline styling; bundle size grew slightly with **`workstation.css`**. Further gains: lazy-load **@dnd-kit**, optional screenshot refresh in docs.

## Phase 44 — Workstation design-system completion + route-level/code-splitting performance pass (complete)

Implemented:
- **`workstation-patterns.css`**: page grids, capture/form **2-column** grids, field labels, check rows/groups, mono **pre** blocks, navigator **pair** rows, findings-diff/outline, summary **shell** + **callouts**, **pill** link buttons, **route** / **customizer** loading shells; **`pqat-details--muted`** in **`workstation.css`**.
- **Compare UI alignment**: **`CompareCapturePanel`**, **`CompareNavigatorPanel`**, **`CompareSummaryColumn`**, **`ComparePage`**, **`CompareIntroPanel`**, **`ComparePairColumn`** — reduced inline layout; shared classes for metrics, index/suggestion blocks, warnings/empty/loading panels.
- **Lazy delivery**: **`App.tsx`** — **`React.lazy`** for **`AnalyzePage`** / **`ComparePage`** + per-route **`Suspense`** with **`RouteFallback`**; **`AnalyzeWorkspaceCustomizer`** / **`CompareWorkspaceCustomizer`** mount **`React.lazy`** **`*Inner`** modules when **Customize workspace** opens (**`CustomizerBodyFallback`**).
- **Tests**: **`waitForLazyApp.ts`**; **`setup.ts`** preloads **`*Inner`** modules so **Suspense** resolves under jsdom; **`App.smoke`** scopes **Plan inputs** panel queries (StrictMode); **`vitest.config.ts`** **`testTimeout: 30_000`**; **`AnalyzePage.interaction`** / **`ComparePage.ux`** await lazy routes.
- **Docs**: **`architecture.md`**, **`index.md`**, **`analyze-workflow.md`**, **`compare-workflow.md`**, this log.

Verified (this phase):
- Frontend: `cd src/frontend/web && npx vitest run` — **104** passed (**21** files); `npm run build` — **no** default chunk &gt;500 kB warning; main **`index-*.js`** ~**226** kB (~**72** kB gzip) with **Analyze** / **Compare** / **WorkspaceSortableOrderList** / customizer inners in separate chunks (see `dist/assets/*`).
- Docs: `mkdocs build --strict` OK (`.venv-docs`).
- Docker: `docker compose build` OK (**web** + **api** images).
- Backend: **no backend source changes**; **`dotnet test`** not run on this host (**.NET 8** runtime not installed).

**Limitations:** Some **CompareSummaryColumn** / **Analyze** panels still use occasional inline margins for one-off rhythm; **`WorkspaceSortableOrderList`** remains a **~46 kB** gzip chunk (DnD) but loads only after opening **Customize** (or when that chunk is prefetched by navigation). Further gains: optional **React Flow** lazy load on Analyze, image refresh in docs.

## Phase 45 — Progressive workspace hydration + graph/list performance (complete)

Implemented:
- **Graph stack**: **`AnalyzePlanGraphCore.tsx`** (React Flow + toolbar) as a **lazy chunk** behind **`AnalyzePlanGraphLazy`** + **`PlanGraphSkeleton`**; **`AnalyzePlanGraph.tsx`** re-exports. **Graph** mode only mounts the chunk; **Text** mode skips it. **`prefetchAnalyzePlanGraph()`** on **Graph** segment **hover/focus** and **`requestIdleCallback`** (fallback **setTimeout**) when already in graph mode.
- **Heavy panel shell**: **`HeavyPanelShell`** + **`LowerBandPanelSkeleton`**; graph skeleton + panel skeleton styles in **`workstation-patterns.css`** (**`pqat-graphSkeleton*`**, **`pqat-heavyPanel*`**, **`pqat-panelSkeleton*`**).
- **Analyze lower band**: **`AnalyzePage`** **`React.lazy`** for **`AnalyzeFindingsPanel`**, **`AnalyzeOptimizationSuggestionsPanel`**, **`AnalyzeSelectedNodePanel`** + per-column **`Suspense`** + **`LowerBandPanelSkeleton`**.
- **Virtual lists**: **`VirtualizedListColumn`** (**`@tanstack/react-virtual`**, **`VIRTUAL_LIST_THRESHOLD`**) — long **Analyze** findings and optimization suggestions; long **Compare** findings diff (threshold in **`CompareNavigatorPanel`**). Defaults use **`min(560px, max(280px, 58vh))`**-style caps so short viewports still get a usable scroll height.
- **Selected node**: **`AnalyzeSelectedNodeHeavySections`** lazy chunk + **`Suspense`** skeleton under the compact header.
- **Tests**: **`setup.ts`** preloads **`AnalyzePlanGraphCore`** and lower-band / heavy-section modules; **`AnalyzePage.interaction`** — text vs graph **React Flow** presence; **`AnalyzeFindingsPanel.virtual.test.tsx`** — virtual vs non-virtual list labeling.
- **Docs**: **`architecture.md`**, **`index.md`**, **`analyze-workflow.md`**, **`compare-workflow.md`**, this log.

Verified (this phase):
- Frontend: `cd src/frontend/web && npm test` — **107** passed (**22** files); `npm run build` OK; Vite splits **`AnalyzePlanGraphCore`** (~**144** kB JS / ~**46** kB gzip) and **`VirtualizedListColumn`** (~**17** kB JS / ~**5** kB gzip) into separate assets.
- Docs: `mkdocs build --strict` (run in this phase when `.venv-docs` is available).
- Docker: `docker compose build` OK (**web** + **api**).
- Backend: **no backend source changes**; **`dotnet test`** not run on this host (**.NET 8** runtime not installed).

**Limitations:** Virtualization relies on **scroll host** `offsetHeight` in TanStack’s observer — very small containers in exotic layouts could still under-measure until resize. **jsdom** tests avoid asserting virtual row clicks without layout stubs; behavior is covered via list-mode labeling + full-app graph/text test. **Compare** pair column is not further code-split in this phase.

## Phase 46 — Build stabilization + Compare selected-pair staged hydration (complete)

Implemented:
- **TypeScript / Docker build fix**: **`AnalyzeFindingsPanel.virtual.test.tsx`** — add **`import { …, vi } from 'vitest'`** so **`tsc -b`** (which typechecks **`src/test/**`**) succeeds in the **web** Docker image.
- **Vitest policy (documented)**: **`vitest.config.ts`** comment — keep **globals off**; **`docs/contributing.md`** — explicit **`vitest`** imports required because **`tsconfig.app.json`** includes tests without **`vitest/globals`**.
- **Compare staged pair detail**: **`CompareSelectedPairHeavySections.tsx`** — moved dense UI from **`CompareSelectedPairPanel`**; panel uses **`React.lazy`** + **`Suspense`** + **`PairHeavyFallback`** (skeleton + hint). Styles: **`pqat-pairHeavySkeleton`** in **`workstation-patterns.css`**.
- **Tests**: **`setup.ts`** preloads **`CompareSelectedPairHeavySections`** for deterministic jsdom; **`ComparePage.ux.test.tsx`** — new test for eager copy/confidence + **`waitFor`** **Key metric deltas**.
- **Bundle**: **`CompareSelectedPairHeavySections`** becomes a separate Vite chunk (~**14** kB JS); **`ComparePage`** chunk size drops.

Verified (this phase):
- Frontend: `cd src/frontend/web && npm test` — **108** passed (**22** files); `npm run build` OK.
- Docker: `docker compose build web` OK (**`tsc -b` + vite** inside **node:20-alpine**).
- Docs: `mkdocs build --strict` OK.
- Backend: **no backend source changes**; **`dotnet test`** not run on this host (**.NET 8** runtime not installed).

**Limitations:** **Branch context** strip remains eager (not split in this phase). Pair heavy chunk still loads as soon as a pair is selected — no idle prefetch yet.

## Phase 47 — Human-readable optimization suggestions overhaul (complete)

Implemented:
- **Backend model** (`OptimizationSuggestionModels.cs`): **`OptimizationSuggestionFamily`** enum (JSON snake_case), **`RecommendedNextAction`**, **`WhyItMatters`**, optional **`TargetDisplayLabel`**, **`IsGroupedCluster`**; new **`OptimizationSuggestionFamilyJsonConverter`**.
- **Analyze synthesis** (`OptimizationSuggestionEngine.cs`): rewritten titles/summaries/validation copy; **`HumanLabel`** via **`NodeLabelFormatter`**; **sort** cards avoid raw **`root.*`** in summaries; **statistics** findings (**G** / **A**) **merge** into one suggestion when multiple fire; **`ValExplainBuffers`** wording tightened.
- **Compare synthesis** (`CompareOptimizationSuggestionEngine.cs`): same fields + **`CmpHumanLabel`** on plan B; compare-specific **Next** / **Why** / validation phrasing; **`AddNewAccessPathConcern`** takes full comparison for labels.
- **Reports** (`PlanAnalysisService.cs`): markdown/HTML/compare markdown list **title + family + next + why** instead of enum soup.
- **Frontend** (`api/types.ts`, **`optimizationSuggestionsPresentation.ts`**): family labels, **`suggestionConfidenceShort` / `suggestionPriorityShort`**, **`groupOptimizationSuggestionsForUi`**, **`suggestionMetadataSentence`**; **`AnalyzeOptimizationSuggestionsPanel`** — family chips, **Try next** / **Why it matters**, **Validate ·**, grouped sections when helpful, **empty state**, **Combined suggestion** badge; **Plan guide** + **Selected node** + **Compare** summary/pair panels updated.
- **Styles** (`workstation.css`): **`pqat-chip--suggestionMeta`**, **`pqat-suggestionGroupedBadge`**, **`pqat-suggestionMeta--readable`**.
- **Tests**: backend **`OptimizationSuggestionEngineTests`** (consolidation, human fields, no **`root.`** in sort summaries); frontend **`optimizationSuggestionsPresentation.test.ts`**; **`AnalyzePage.interaction`**, **`ComparePage.ux`** assertions for readable metadata.
- **Docs**: **`analyze-workflow.md`**, **`compare-workflow.md`**, **`findings-catalog.md`**, **`architecture.md`**, this log.

Verified (this phase):
- Frontend: `cd src/frontend/web && npx vitest run` — **109** passed (**22** files); `npm run build` OK.
- Backend: `docker run --rm -v "$(pwd)":/src -w /src mcr.microsoft.com/dotnet/sdk:8.0 dotnet test tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/PostgresQueryAutopsyTool.Tests.Unit.csproj -c Release` — **106** passed (host lacks **.NET 8** runtime; Docker SDK **8.0** used).
- Docs: `mkdocs build --strict` when `.venv-docs` is available (run locally).
- Docker: `docker compose build web` OK (same as Phase 46 policy).

**Limitations:** Virtualized **optimization** list skips **family subheadings** (only used when grouping is off); very large grouped sets still scroll as a flat virtual list. Compare **carried** suggestions from plan B reuse analyze **SuggestionId** hashing on a prefixed title—stable but not re-hashed on merge. Further work: idle **prefetch** for Compare pair heavy sections (deferred per mission).

## Phase 48 — Suggestion virtualized grouping + persisted compatibility + Compare pair prefetch (complete)

Implemented:
- **Grouped + virtualized suggestions:** **`flattenGroupedSuggestionsForVirtualList`**, **`suggestionVirtualRowEstimateSize`**, **`VirtualizedListColumn` `getItemSize`** — family **header rows** stay in the virtual list alongside cards (**`AnalyzeOptimizationSuggestionsPanel`**).
- **Client normalization:** **`normalizeOptimizationSuggestionForDisplay` / `normalizeOptimizationSuggestionsForDisplay`** — infer **`suggestionFamily`**, backfill **Next** / **Why** / **`targetDisplayLabel`** for older SQLite snapshots missing Phase 47 properties; wired on **Analyze** + **Compare** suggestion lists.
- **Compare carried ids:** **`CompareOptimizationSuggestionEngine.CmpCarriedFromPlanBId`** — **`sg_*`** from structured payload + source analyze **`SuggestionId`**, not title text.
- **Prefetch:** **`prefetchCompareSelectedPairHeavySections.ts`**; **`ClickableRow` `onPointerIntent`** on navigator / findings diff / top changes / branch strip; summary **Focus plan B** **`onMouseEnter`/`onFocus`**; **`ComparePage` `useEffect`** idle warm after **`comparisonId`** (cleanup matches **`AnalyzePlanWorkspacePanel`** idle pattern).
- **UX:** **`PairHeavyFallback`** calmer copy + fewer skeleton bars; **`pqat-fadeInSoft`** on **`pqat-pairHeavySkeleton`**.
- **Tests:** **`optimizationSuggestionsPresentation.test.ts`** (flatten + legacy normalize); **`AnalyzeOptimizationSuggestionsPanel.test.tsx`** (mock **`VirtualizedListColumn`**, assert **`.pqat-suggestionVirtualHeader`** rows); **`ClickableRow.test.tsx`**; **`prefetchCompareSelectedPairHeavySections.test.ts`**; **`ComparePage.ux`** prefetch hover + **`vi.mock`**; **`CompareOptimizationSuggestionEngineTests`** carried-id stability; **`setup.ts`** drops eager **`AnalyzeOptimizationSuggestionsPanel`** import so per-test **`vi.mock('../VirtualizedListColumn')` works** — **`AnalyzePage.interaction`** preloads the panel module instead.
- **Docs:** **`analyze-workflow.md`**, **`compare-workflow.md`**, **`architecture.md`**, **`api-and-reports.md`**, this log.

Verified (this phase):
- Frontend: `cd src/frontend/web && npx vitest run` — **115** passed (**25** files); `npm run build` OK.
- Backend: `docker run --rm -v "$(pwd)":/src -w /src mcr.microsoft.com/dotnet/sdk:8.0 dotnet test tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/PostgresQueryAutopsyTool.Tests.Unit.csproj -c Release` — **107** passed (first `--no-restore` attempt may warn on cold cache; restore + test succeeded).
- Docs: `mkdocs build --strict` when `.venv-docs` + plugins are installed (run locally if needed).
- Docker: `docker compose build web` (run locally; expected OK per prior phases).

**Limitations:** Virtual lists still depend on scroll-host measurement in jsdom for full integration tests (panel test uses a **`VirtualizedListColumn` mock). Prefetch only warms JS; first paint of heavy pair UI can still wait on slow devices if the chunk is large. Carried compare ids change vs pre-Phase-48 title-based scheme—deep links pinning those ids could differ after upgrade (rare; ids are compare-scoped).

## Phase 49 — Persisted artifact versioning + compatibility/migration hardening (complete)

Implemented:
- **Backend:** **`ArtifactSchema`** / **`PersistedArtifactNormalizer`** / **`OptimizationSuggestionCompat`**; **`PlanAnalysisResult`** + **`PlanComparisonResultV2`** carry **`ArtifactSchemaVersion`**, **`ArtifactPersistedUtc`**; **`OptimizationSuggestion.AlsoKnownAs`** for compare carried-suggestion legacy ids; **`ArtifactReadResult`** + **422** (`artifact_corrupt`) / **409** (`artifact_version_unsupported`) on GET; **`SqliteArtifactStore`** stamps version on save, normalizes on read, retains corrupt rows; unit tests (**`PersistedArtifactNormalizerTests`**, **`SqliteArtifactStoreReadTests`**).
- **Frontend:** **`artifactSchemaVersion`**, **`artifactPersistedUtc`** on API types; **`ArtifactCorruptError`**, **`ArtifactIncompatibleSchemaError`** from **`getAnalysis`/`getComparison`**; **Analyze** / **Compare** persisted-load error messaging; **`resolveCompareSuggestionParamToCanonicalId`** + Compare URL sync for **`suggestion=`** aliases; sharing reload error surface on **Analyze** summary card; display normalization comment (server-first).
- **Docs:** **`api-and-reports.md`** (versioning, GET errors, compatibility matrix), **`architecture.md`**, **`analyze-workflow.md`**, **`compare-workflow.md`**, this log.

Verified (this phase):
- Frontend: `cd src/frontend/web && npx vitest run` — **117** passed (**25** files); `npm run build` OK. **`AnalyzePage.interaction`**: extended **`findByRole`** timeout for lazy **Plan guide** customizer list (parallel-run flake).
- Backend: `docker run --rm -v "$(pwd)":/src -w /src mcr.microsoft.com/dotnet/sdk:8.0 dotnet test tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/PostgresQueryAutopsyTool.Tests.Unit.csproj -c Release` — **113** passed (omit **`--no-restore`** on cold cache).
- Docs: `.venv-docs/bin/mkdocs build --strict` OK.
- Docker: `docker compose build web` OK.

**Limitations:** Not every historical field permutation is migrated—only explicit, test-covered paths. **`alsoKnownAs`** covers high-value compare carried-suggestion id drift, not arbitrary client-side invented ids. Future schema bumps require incrementing **`ArtifactSchema`** and extending the normalizer.

## Phase 50 — Browser E2E smoke for persisted / deep-link flows (complete)

Implemented:
- **Playwright** (`@playwright/test`), config **`playwright.config.mjs`**, specs **`src/frontend/web/e2e/persisted-flows.spec.ts`**, bundled plan JSON under **`e2e/fixtures/`** (copies of backend unit fixtures).
- **API (gated):** **`E2E:Enabled`** → **`E2eSeedEndpoints`**: corrupt analysis JSON, future **`artifactSchemaVersion`** analysis, comparison with carried suggestion + legacy alias; **`SqliteArtifactStore.UpsertRawJsonForE2E`**. *(Phase 51: **`PQAT_E2E_ENABLED`** via **`.env.testing`** on **`docker compose`**, not a separate compose file.)*
- **UI hooks:** **`data-testid`** on Analyze error / persisted loading, Compare error / persisted loading, **`compare-plan-a-text`** / **`compare-plan-b-text`**; **`vite.config.ts`** **`/api`** proxy to **8080** for local Vite E2E.
- **Automation:** **`scripts/e2e-playwright-docker.sh`** (compose + Playwright container for macOS); **`.github/workflows/ci.yml`** job **`e2e-playwright`**.
- **Docs:** **`contributing.md`**, **`architecture.md`**, this log.

Verified (this phase):
- **Playwright:** `docker run … mcr.microsoft.com/playwright:v1.52.0-jammy` against **`host.docker.internal:3000`** with compose **e2e** stack — **6** tests passed (persisted analyze+node, compare reopen, lazy pair heavy, **422**, **409**, suggestion alias).
- **Frontend (Node 20, matches CI):** `docker run node:20-alpine` in **`src/frontend/web`** — **`npm ci`**, **`npm test`**, **`npm run build`** OK.
- **Typecheck (host):** `npx tsc -b` in **`src/frontend/web`** OK.
- **Backend:** `docker … dotnet sdk:8.0 dotnet test` — **113** passed (includes API compile with **E2e** code).
- **Docker:** `docker compose build web` OK after UI testids (Phase 50); Phase 51 folds E2E env into **`.env.testing`** + **`testing`** profile (see Phase 51).

**Limitations:** E2E seeds are **powerful**—must stay off outside test/staging. Suite is **serial** (**`workers: 1`**) against one SQLite volume. Host **Node 25** + current **Vite** may fail **`npm run build`** locally (rolldown optional native binding); use **Node 20** or Docker as in CI. **`e2e/fixtures`** can drift from **`tests/backend.unit/.../postgres-json`** if fixtures change (Phase 51 adds **`fixtures:sync`** / **`fixtures:check`**).

## Phase 51 — Compose profiles + testing ergonomics (complete)

Implemented:
- **`docker-compose.yml`:** **`api`** + **`web`** always; **`playwright`** on **`profiles: [testing]`**; **`E2E__Enabled=${PQAT_E2E_ENABLED:-false}`**; removed separate **`docker-compose.e2e.yml`** (behavior via **`.env.testing`** + same file).
- **`.env.testing`** / **`.env.testing.example`:** document **`PQAT_E2E_ENABLED=true`** for seed routes only when running E2E.
- **Scripts:** **`scripts/e2e-playwright-docker.sh`** uses **`--env-file .env.testing`** + **`--profile testing run --rm playwright`**; **`scripts/sync-e2e-fixtures.sh`**, **`scripts/check-e2e-fixtures.mjs`**; **`npm run fixtures:sync` / `fixtures:check`** in **`src/frontend/web/package.json`**.
- **Tooling:** **`engines.node`**, **`.nvmrc`** (**20**); contributor notes on Node 20 vs 25 / Rolldown.
- **CI:** **`e2e-playwright`** job aligned with compose profile + in-container Playwright; frontend job runs **`fixtures:check`**.
- **Docs:** **`contributing.md`**, **`architecture.md`**, **`getting-started.md`**, this log; **`e2e/auth/README.md`**, **`e2e/visual/README.md`** as minimal future hooks.
- **Makefile:** **`e2e-playwright-docker`** target; help typo fix (**`test-frontend`**).

Verified (this phase, agent run):
- **`docker compose config --services`:** **`api`**, **`web`** only (no **`playwright`** without **`--profile testing`**).
- **`docker compose --profile testing config --services`:** **`api`**, **`web`**, **`playwright`**.
- **`node scripts/check-e2e-fixtures.mjs`** / **`npm run fixtures:check`:** OK.
- **Frontend:** `cd src/frontend/web && npm ci && npm run fixtures:check && npm test && npm run build` — **117** Vitest tests + production build OK (agent host **Node 25** with **`npm` EBADENGINE** warning vs **`engines`**; **CI** uses **Node 20**).
- **Docs:** `mkdocs build --strict` — OK.
- **Backend:** `docker run … mcr.microsoft.com/dotnet/sdk:8.0 dotnet test tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/PostgresQueryAutopsyTool.Tests.Unit.csproj -c Release` — **113** passed.
- **Docker images:** `docker compose build` — OK (**api** + **web**).
- **E2E:** `docker compose --env-file .env.testing up -d --build api web` + `docker compose --env-file .env.testing --profile testing run --rm playwright` — **6** Playwright tests passed; **`docker compose --env-file .env.testing down -v`** teardown OK.

**Limitations:** **`docker compose --profile testing up -d`** starts a **`playwright`** container that runs once and exits (service **exited**); prefer **`run --rm playwright`** for clarity. Visual regression remains a small doc stub under **`e2e/visual/`**.

## Phase 52 — First real auth-mode browser E2E (complete)

Implemented:
- **Strategy:** **API key** auth for deterministic principals (**`X-Api-Key`**); Playwright **`extraHTTPHeaders`** per browser context (no **`VITE_AUTH_*`** rebuild for Docker **`web`** image).
- **`.env.testing.auth`** / **`.env.testing.auth.example`:** **`PQAT_AUTH_ENABLED`**, **`PQAT_AUTH_MODE=ApiKey`**, three seeded keys (**`e2e-user-a`**, **`e2e-user-b`** in **`e2e-group-research`**; **`e2e-user-c`** ungrouped).
- **`docker-compose.yml`:** maps **`PQAT_*`** → **`Auth__*`** / **`Auth__ApiKey__Seeds__*__*`**; passes **`PQAT_E2E_*`** into **`playwright`** for test constants; **`PLAYWRIGHT_CLI_ARGS`** (default **`--project=e2e-smoke`**); command runs **`npx playwright test … $PLAYWRIGHT_CLI_ARGS`**.
- **Playwright:** projects **`e2e-smoke`** (**`persisted-flows.spec.ts`**) and **`e2e-auth-api-key`** (**`auth-artifact-access.spec.ts`**); **`npm run test:e2e`** = smoke; **`npm run test:e2e:auth`** = auth.
- **Specs:** owner persist/reopen; cross-user **private** denial (**`analyze-page-error`**); **group** scope via **Sharing** UI + member access + outsider denial.
- **Playwright ↔ SPA:** **`e2e/auth/installApiKeyRoute.ts`** adds **`X-Api-Key`** on **`/api/*`** via **`page.route`** so **`fetch()`** matches real auth traffic ( **`extraHTTPHeaders`** alone was insufficient for SPA subrequests in practice).
- **UI:** **`data-testid`** on **`ArtifactSharingPanel`** (incl. **`artifact-sharing-status`** on save/error line).
- **Scripts / Make:** **`e2e-playwright-docker.sh --auth`**, **`make e2e-playwright-docker-auth`**.
- **CI:** job **`e2e-playwright-auth`** (**.env.testing.auth** + **`e2e-auth-api-key`**).
- **Docs:** **`contributing.md`**, **`deployment-auth.md`**, **`architecture.md`**, **`e2e/auth/README.md`**, this log.

Verified (this phase, agent run):
- **Smoke E2E:** **6** tests (**`e2e-smoke`**) with **`.env.testing`** — OK.
- **Auth E2E:** **3** tests (**`e2e-auth-api-key`**) with **`.env.testing.auth`** — OK (stable after waiting for **GET** analysis reload following **PUT** sharing).
- **Frontend (Node 20, CI parity):** `docker run node:20-alpine` with repo mounted at **`/repo`**, **`cd /repo/src/frontend/web`**, **`npm ci`**, **`fixtures:check`**, **`npm test`**, **`npm run build`** — **117** Vitest tests + build OK. **Host Node 25** on this machine failed **Vitest** startup (**rolldown** native binding) — use **Node 20** per **`engines`** / **`.nvmrc`**.
- **Docs:** **`mkdocs build --strict`** — OK.
- **Backend:** **`docker … dotnet sdk:8.0 dotnet test`** — **113** passed.

**Limitations:** JWT / proxy / legacy bearer are **not** covered in browser E2E yet. Auth job uses a **fresh volume** per run. **`PLAYWRIGHT_CLI_ARGS`** is a single token today (**`--project=…`**). Seeded API keys live in **`.env.testing.auth`** — rotate if a leak is ever suspected.

## Phase 53 — JWT bearer browser smoke + Compare auth parity (complete)

Implemented:
- **Second auth strategy in browser E2E:** **JWT bearer** (**`Auth__Mode=JwtBearer`**) with deterministic **`sub`** values (**`PQAT_JWT_SUB_A`**, **`PQAT_JWT_SUB_B`**) and HS256 signing material in **`.env.testing.jwt`** / **`.env.testing.jwt.example`**.
- **Playwright:** project **`e2e-auth-jwt`** (**`jwt-auth-smoke.spec.ts`**); **`installBearerRoute`** + **`jwtMint.ts`** / **`jwtConfig.ts`** mirror the API-key **`page.route`** pattern for **`fetch('/api/…')`**.
- **Coverage:** **Analyze** persist + reopen; **Compare** persist + reopen; **Compare** cross-subject denial (**`compare-page-error`**, access denied text).
- **Compose / scripts / CI:** **`docker-compose.yml`** JWT env mapping; **`e2e-playwright-docker.sh --jwt`**, **`make e2e-playwright-docker-jwt`**, **`npm run test:e2e:jwt`**, CI job **`e2e-playwright-jwt`**.
- **Docs / ops:** **`deployment-auth.md`** reverse-proxy header forwarding (**`Authorization`**, **`X-Api-Key`**); **`nginx.conf`** comment block; **`contributing.md`**, **`architecture.md`**, **`e2e/auth/README.md`**.
- **Tooling:** **`volta`** block in **`src/frontend/web/package.json`** (**Node 20.18.0**); **`.tool-versions`** for asdf.

Verified (this phase, agent run, 2026-03-31):
- **Smoke E2E:** **6** tests (**`e2e-smoke`**) with **`.env.testing`** — OK.
- **API key auth E2E:** **3** tests (**`e2e-auth-api-key`**) with **`.env.testing.auth`** — OK.
- **JWT auth E2E:** **3** tests (**`e2e-auth-jwt`**) with **`.env.testing.jwt`** — OK.
- **Frontend (Node 20, Docker `node:20-alpine`):** **`npm ci`**, **`fixtures:check`**, **`npm test`**, **`npm run build`** — **117** Vitest tests + build OK.
- **Docs:** **`mkdocs build --strict`** — OK.
- **Backend:** **`docker … mcr.microsoft.com/dotnet/sdk:8.0 dotnet test PostgresQueryAutopsyTool.sln -c Release`** — **113** passed (first **`--no-restore`** attempt hit a transient package path issue; restore + test succeeded).

**Limitations (at Phase 53 closure):** Trusted-proxy/header browser E2E was deferred to **Phase 54**. JWT suite does **not** duplicate API-key group-sharing matrix on **Compare**. **`PLAYWRIGHT_CLI_ARGS`** remains one project selector. Host **Node 25** may still break Vitest; use **Node 20** (**Volta** / **asdf** / **`.nvmrc`**).

## Phase 54 — Trusted-header auth smoke + E2E/CI ergonomics (complete)

Implemented:
- **ProxyHeaders browser proof:** **`.env.testing.proxy`** / **`.env.testing.proxy.example`** (**`PQAT_AUTH_MODE=ProxyHeaders`**), Playwright **`e2e-auth-proxy`** (**`proxy-auth-smoke.spec.ts`**): **Analyze** persist + reopen, second user **private** denial. **`e2e/auth/installProxyHeadersRoute.ts`** + **`proxyHeadersConfig.ts`** inject **`X-PQAT-User`** (and optional groups) on **`/api/*`**.
- **Explicit non-coverage:** **`BearerSubject`** (legacy bearer-as-user-id) documented as **not** browser-E2E’d in **`deployment-auth.md`** / **`e2e/auth/README.md`**.
- **E2E ergonomics:** Refactored **`scripts/e2e-playwright-docker.sh`** with **`run_one_suite`**, **`--proxy`**, **`--all-auth`** (sequential api-key → jwt → proxy with **`down -v`** between), **`--help`**. **`Makefile`** targets **`e2e-playwright-docker-proxy`**, **`e2e-playwright-docker-all-auth`**. **`package.json`**: **`test:e2e:api-key`** (duplicate of **`test:e2e:auth`**), **`test:e2e:proxy`**.
- **CI:** New job **`e2e-playwright-proxy`**; existing E2E jobs keep stable **job ids** (**`e2e-playwright`**, **`e2e-playwright-auth`**, **`e2e-playwright-jwt`**) with human-readable **`name:`**; steps echo local reproduce commands. **`docker-compose.yml`** passes **`PQAT_PROXY_USER_ID_*`** into **`playwright`**.
- **Docs / nginx:** **`contributing.md`** project table + sequential auth note; **`deployment-auth.md`** browser coverage table; **`architecture.md`**; **`nginx.conf`** header comment; this log.

Verified (this phase, agent run, 2026-03-31):
- **Smoke E2E:** **6** tests (**`e2e-smoke`**, **`.env.testing`**) — OK.
- **API key E2E:** **3** tests (**`e2e-auth-api-key`**) — OK.
- **JWT E2E:** **3** tests (**`e2e-auth-jwt`**) — OK.
- **Proxy headers E2E:** **2** tests (**`e2e-auth-proxy`**, **`.env.testing.proxy`**) — OK.
- **`./scripts/e2e-playwright-docker.sh --all-auth`:** api-key → jwt → proxy sequential run — OK.
- **Frontend (Docker `node:20-alpine`):** **`npm ci`**, **`fixtures:check`**, **`npm test`**, **`npm run build`** — **117** Vitest tests + build OK.
- **Docs:** **`mkdocs build --strict`** — OK.
- **Backend:** **`docker … dotnet/sdk:8.0 dotnet test PostgresQueryAutopsyTool.sln -c Release`** — **113** passed.

**Limitations:** **`BearerSubject`** remains **without** browser E2E (documented). **`PLAYWRIGHT_CLI_ARGS`** still selects **one** project per compose run. Compare **group** sharing is **not** duplicated for **ProxyHeaders** or **JWT** (small matrix). No Docker layer cache optimization in CI this phase (clarity-first job layout only).

## Phase 55 — Futuristic UI/UX modernization (complete)

Implemented:
- **Typography:** Google Fonts **Outfit** (headings), **IBM Plex Sans**, **JetBrains Mono** (`index.html`); **`index.css`** **`--sans` / `--heading` / `--mono`**.
- **Tokens:** Light + dark **`--signal-*`** (info/warn/error/denial), **`--deck-accent`**, dark **ambient** `#root` gradients; **`prefers-reduced-motion: reduce`** throttles animations/transitions globally.
- **Patterns (`workstation-patterns.css`):** **`pqat-stateBanner`** variants (error/warn/denial/info/loading), **`pqat-emptyHint`**, **`pqat-summaryDeck`**, **`pqat-commandTitle`**, **`pqat-sharingDetails`** + **`__body`**, **`pqat-sectionHeadline`**, **`pqat-introBanner`**, **`pqat-workspaceReveal`**; merged **summary shell** glow; **heavy panel** header gradient; removed duplicate **`.pqat-graphFrame`** override so **`workstation.css`** instrument frame wins.
- **Chrome (`workstation.css` + `App.css`):** Panel header **accent line** pseudo-element; graph frame **depth** (accent hairline + soft outer glow); **guided suggestion** rail + **`pqat-signalLine`** blocks; **selected** **`ClickableRow`** outer glow; top bar **gradient hairline** + **brand tagline**.
- **Components:** **`AnalyzeCapturePanel`** banners + empty hint; **`AnalyzeSummaryCard`** summary deck; **`ComparePage`** aligned banners/empty/loading; **`ArtifactSharingPanel`** redesigned **Sharing & access** details; **`AnalyzeOptimizationSuggestionsPanel`** guided layout; **`AnalyzeFindingsPanel`** **`accent-bar`** selection; **`CompareIntroPanel`** / **`CompareSummaryColumn`** / **`HeavyPanelShell`** reveal classes; **`index.html`** document title.
- **Tests:** **`AnalyzePage.interaction.test.tsx`** — empty-state copy smoke.
- **Docs:** **`index.md`**, **`analyze-workflow.md`**, **`compare-workflow.md`**, **`deployment-auth.md`**, **`architecture.md`**, **`e2e/visual/README.md`**, this log.

Verified (this phase, agent run, 2026-03-31):
- **Frontend (Docker `node:20-alpine`):** **`npm ci`**, **`npm test`**, **`npm run build`** — **118** Vitest tests + build OK. (Host Node 25: Vitest/rolldown binding still unreliable — use Node 20.)
- **Docs:** **`mkdocs build --strict`** — OK.
- **Backend:** **`docker … dotnet/sdk:8.0 dotnet test PostgresQueryAutopsyTool.sln -c Release`** — **113** passed.

**Limitations:** No committed Playwright screenshot baselines. Light theme received token definitions but the product aesthetic is still **dark-first**. External font CDN requires network at first paint (preconnect mitigates).

