# Architecture Overview

This repository is a disciplined monorepo with:
- `src/backend/`: Backend analysis engine + HTTP API (ASP.NET Core Minimal API)
- `src/frontend/web/`: Interactive forensic UI (React + TypeScript + Vite)
- `src/shared/`: (reserved for future shared DTOs/utilities; optional)

The backend is organized as a modular monolith:
- `PostgresQueryAutopsyTool.Core`
  - Raw plan DTO shapes (Postgres JSON schema)
  - Normalized plan node model
  - Analysis pipeline:
    - Parser (`EXPLAIN (FORMAT JSON)` → `NormalizedPlanNode`; BUFFERS counters from flat node keys and/or nested `Buffers`, plus conservative `Workers` merge onto the parent when a counter is missing there, while still storing each worker line as `PlanWorkerStats` on `NormalizedPlanNode.Workers`)
    - Index posture (`IndexSignalAnalyzer` → `PlanIndexOverview` + bounded `PlanIndexInsight[]` on `PlanAnalysisResult`; feeds Analyze UI and complements findings **P/Q/R/S** without duplicating rule ranking)
    - Derived metrics (`DerivedMetricsEngine` → per-node metrics + shares)
    - Findings (`FindingsEngine` + rules → ranked evidence-based findings)
    - Summary + narrative + **Phase 60–61** **`PlanStory`** (`PlanStoryBuilder` after suggestions: execution overview, work concentration, expense drivers, inspect-first path, **`StoryPropagationBeat[]`** propagation lines each with optional **`focusNodeId`** + human **`anchorLabel`**, index/shape note with operator anchors when an index insight maps to a node). **Phase 61** **`PlanNodeHumanReference`** + **`PlanNodeReferenceBuilder`** derive operator/relation/join-role/sort/aggregate/gather labels (hedged **`QueryCorrespondenceHint`** when source SQL is present); **`NodeLabelFormatter.ShortLabel`** delegates to **`PrimaryLabelCore`** so narrative/bottlenecks avoid raw **`root.*`** paths when evidence exists. Summary + narrative (`PlanSummaryBuilder` builds `PlanSummary` including **Phase 58–59** `Bottlenecks` via internal `PlanBottleneckBuilder` + **`HumanAnchorLabel`** on each insight, `BottleneckClassifier` for **`BottleneckClass`** / **`BottleneckCauseHint`**, **`BottleneckPropagationHelper`** for **`PropagationNote`**; `NarrativeGenerator` uses **`SafePrimary`** for hotspot lists; `OperatorNarrativeHelper` + selected-node interpretation include optional query hints; `PlanNodeInterpretationAugmentor` runs after summary with query text)
    - Optimization suggestions (`OptimizationSuggestionEngine`): consumes findings, `PlanIndexOverview` / `PlanIndexInsight[]`, and per-node `OperatorContextEvidence` (+ worker lists on `NormalizedPlanNode`) to emit ranked, evidence-linked `OptimizationSuggestion` records (categories, action types, **`OptimizationSuggestionFamily`**, **`RecommendedNextAction`**, **`WhyItMatters`**, optional **`TargetDisplayLabel`**, **`IsGroupedCluster`**, cautions, validation steps). Copy is **human-readable** in titles/summaries; raw finding snippets remain in **details**/**rationale**. Overlapping **statistics** findings consolidate conservatively into one grouped card. **Not** a second findings engine and **not** DDL prescriptions.
    - Compare-scoped suggestions (`CompareOptimizationSuggestionEngine`): runs after `ComparisonEngine` produces findings diff + `IndexComparisonSummary`, yielding `compareOptimizationSuggestions` oriented to “what to try next on plan B given the change,” using the same extended suggestion model and **`NodeLabelFormatter`**-style labels for plan B targets.
  - Comparison engine (heuristic node mapping + deltas + pair details + findings diff)
  - Report generators (Markdown/HTML/JSON) rendered from `PlanAnalysisResult`
- `PostgresQueryAutopsyTool.Api`
  - HTTP endpoints
  - Request validation
  - **SQLite artifact persistence** (`IArtifactPersistenceStore` / `SqliteArtifactStore`): full JSON snapshots for **`PlanAnalysisResult`** and **`PlanComparisonResultV2`** (opaque ids, optional TTL / max-row retention). **Phase 49:** writes stamp **`ArtifactSchemaVersion`** / persistence time; reads deserialize with tolerant JSON converters, then **`PersistedArtifactNormalizer`** upgrades legacy payloads and may attach **`alsoKnownAs`** on compare suggestions for deep-link stability; corrupt rows yield **422**, unsupported future schema **409** (rows retained on corrupt reads). **Phase 50:** optional **`E2E:Enabled`** registers **`/api/e2e/seed/*`** helpers plus **`SqliteArtifactStore.UpsertRawJsonForE2E`** for deterministic browser tests only.
  - **Auth (Phase 37–38):** **`AuthIdentityMiddleware`** resolves **`UserIdentity`** (stable **`UserId`**, **group ids**, **`AuthIdentitySource`**) via **`ProxyHeaders`**, legacy **`BearerSubject`**, **`JwtBearer`** (HS256 + **`sub`**), or **`ApiKey`** ( **`SqliteApiKeyPrincipalStore`** — hashed keys). **`IRequestIdentityAccessor`** is the supported read surface for endpoints; **`ArtifactAccessEvaluator`** enforces **`StoredArtifactAccess`**. Optional fixed-window **rate limiting** on analyze/compare POSTs.
  - Swagger/OpenAPI

**Phase 55 (UI):** Dark-theme **design tokens** gain **signal** colors (info/warn/error/denial) and a subtle **ambient** root background; **`workstation-patterns.css`** adds **state banners**, **summary deck**, **sharing** chrome, and **guided** suggestion blocks. Top bar includes a short **workstation** tagline; **`prefers-reduced-motion`** trims animations.

**Phase 56 (UI delivery + parity):** Typography ships via **bundled `@fontsource/*`** (Outfit, IBM Plex Sans, JetBrains Mono) — no runtime **Google Fonts** dependency. **`artifactErrorPresentation`** + **`ArtifactErrorBanner`** unify **Analyze** and **Compare** persisted/request error tone/title semantics. **`html[data-visual-regression='1']`** flattens **`#root`** background for Playwright pixels. Workspace **customizer** uses **`pqat-customizer--chrome`** to align with sharing panel framing.

**Phase 57 (visual hardening + meta chrome):** **`e2e-visual`** gains a fourth frame (**403** access denied, **`page.route`**-mocked so CI stays on **`.env.testing`** only). **`pqat-metaPanel`** + **`pqat-authHelpCard`** tie **customizer**, **sharing**, and capture **`<details>`** surfaces into one utility family; **`ArtifactErrorBanner`** uses tone-specific body kickers (**Policy** / **Notice** / **Error**). Frontend **`npm test`** = **`vitest run`**; **`test:watch`** for local dev. CI **`frontend`** job calls **`npm test`** without duplicate flags.

**Browser E2E (Phase 50–57):** Playwright smoke exercises persisted **`?analysis=`** / **`?comparison=`**, **`?node=`**, **`?suggestion=`** alias resolution, **422/409** error UI, and staged Compare pair hydration. **Phase 52:** **`e2e-auth-api-key`**. **Phase 53:** **`e2e-auth-jwt`**. **Phase 54:** **`e2e-auth-proxy`**. **Phase 56–57:** **`e2e-visual`** — four canonical screenshots under **`e2e/visual/`**. **Compose:** **`api` + `web`** by default; **`--profile testing`** **`playwright`**; **`PQAT_E2E_ENABLED`** gates **`/api/e2e/seed/*`**. See [Contributing](contributing.md#browser-e2e-playwright).

The frontend communicates with the backend via typed API calls:
- Analyze page: paste/upload plan JSON; **Phase 49** maps **422/409** artifact GET failures to explicit UI copy (corrupt vs unsupported schema vs not found vs access denied). **Phase 39+42** lay out results as a **workspace**: graph/text tree + **Plan guide** rail (`AnalyzePage`, **three-tier** layout via **`useWorkspaceLayoutTier`**: narrow &lt;900px stacks, **medium** 900–1319px keeps side-by-side graph+guide with tuned column ratios, **wide** ≥1320px emphasizes the investigation surface), then lower band for findings + suggestions + selected node; the graph is **`AnalyzePlanGraphLazy`** wrapping **`AnalyzePlanGraphCore`** (React Flow) in a **lazy chunk** with **`PlanGraphSkeleton`** while **Text** mode avoids loading that chunk until **Graph** is chosen (**idle** + **Graph** control **hover/focus** prefetch). **Phase 42** widens the app shell (fluid **`max-width`** in `App.css`). **Phase 43** applies **`workstation.css`** + design tokens. **Phase 44** adds **`workstation-patterns.css`**, **`React.lazy`** for **`AnalyzePage`**, and defers **`AnalyzeWorkspaceCustomizerInner`** until the customizer **`<details>`** opens (with **`RouteFallback`** / **`CustomizerBodyFallback`** loading UI). **Phase 45** adds **lower-band** lazy chunks (**findings** / **suggestions** / **selected node**), **`HeavyPanelShell`** + **`LowerBandPanelSkeleton`**, **`VirtualizedListColumn`** for long findings and suggestion lists, and **`AnalyzeSelectedNodeHeavySections`** lazy-loaded under the selected-node header. **Phase 48** keeps **family group headers** inside the virtualized optimization list via **flattened rows** + **`getItemSize`**, and normalizes **older persisted** suggestion JSON for display.
- Compare page: submit two plans, show diff-aware narrative, changed findings, and a synchronized **branch context** strip (see `compareBranchContext` + `CompareBranchStrip`). **`?suggestion=`** deep links resolve through **`alsoKnownAs`** (Phase 49 server aliases + client **`resolveCompareSuggestionParamToCanonicalId`**) so legacy bookmarked ids still highlight the canonical row. **Phase 41** decomposes the page into `components/compare/*`, adds **`compareWorkspace/`** (layout model + **`useCompareWorkspaceLayout`**, localStorage + optional **`compare_workspace_v1`** user preference), and **`workspaceLayout/reorder.ts`** shared with Analyze for neighbor swaps. **Phase 42** applies the same **layout tiers** to summary + main grids and uses **`components/workspace/WorkspaceSortableOrderList`** (**@dnd-kit** drag + **Up/Down** fallback). **Phase 43** aligns Compare surfaces with **`pqat-*`**. **Phase 44** refines capture/advanced blocks into shared patterns, **`React.lazy`** for **`ComparePage`**, and **`CompareWorkspaceCustomizerInner`** split for on-open loading of DnD lists. **Phase 45** windowizes long **findings diff** lists in **`CompareNavigatorPanel`** with the same **`VirtualizedListColumn`** helper (thresholded; small diffs stay a plain list). **Phase 46** lazy-loads **`CompareSelectedPairHeavySections`** (access path, corroboration, join/context summaries, evidence grids, metric deltas, pair findings, matcher diagnostics) under **`CompareSelectedPairPanel`** with a **`Suspense`** skeleton (**`pqat-pairHeavySkeleton`**), while the pair title, copy actions, optional compare next-step, and confidence line stay eager; **`ComparePage`** shrinks slightly as heavy pair UI moves to its own chunk. **Phase 48** adds **`prefetchCompareSelectedPairHeavySections()`** (coalesced dynamic `import`) on **`ClickableRow` `onPointerIntent`** from navigator pair rows, findings diff rows, **What changed most**, **Branch context** mapped rows, **`requestIdleCallback`** after a comparison loads, and **Focus plan B** hover/focus on summary suggestions—mirroring Analyze graph **idle/hover** prefetch—plus a softer skeleton entry animation.

## Frontend presentation layer (Phase 12)

The UI uses a small presentation helper layer to keep human-readable labeling consistent and to avoid leaking backend-internal ids into primary UX:
- `src/frontend/web/src/presentation/nodeLabels.ts`: node and pair display labels/titles (sort labels align with backend “feed relation + sort key” when `byId` is present)
- `src/frontend/web/src/presentation/planReferencePresentation.ts`: normalize **Phase 61** story beats vs legacy string arrays
- `src/frontend/web/src/presentation/contextBadges.ts`: contextDiff-driven badges for scanability
- `src/frontend/web/src/presentation/comparePresentation.ts`: compare intro copy, summary/coverage phrases, and top-change callouts
- `src/frontend/web/src/presentation/compareBranchContext.ts`: builds the selected-pair **branch view model** (paths, children, mapping/unmatched flags, focal cues) from `PlanComparisonResult` + `matches`
- `src/frontend/web/src/presentation/workerPresentation.ts`: worker summary line + table row shaping for parallel `workers[]` on Analyze selected node
- `src/frontend/web/src/presentation/indexInsightPresentation.ts`: plan overview line, per-node insight cards, compare **access path family** cue (`identity.accessPathFamilyA/B` from API)
- `src/frontend/web/src/presentation/optimizationSuggestionsPresentation.ts`: family + category labels, **readable** confidence/priority fragments (no `Label: value` soup in primary UI), metadata sentence helper, **grouping** helper for long lists, **flattened virtual rows** (header + card) + per-row size hints for **`VirtualizedListColumn`**, **display normalization** for older persisted payloads missing Phase 47 fields, sort order for suggestions (Phase 32 + Phase 47 + Phase 48)
- `src/frontend/web/src/presentation/bottleneckPresentation.ts` (Phase 58–59): short labels for bottleneck **`kind`**, human phrases for **`bottleneckClass`** / **`causeHint`**, stable sort by **`rank`** for the Plan guide **Main bottlenecks** block; suggestion cards resolve **`relatedBottleneckInsightIds`** to those rows when present
- `src/frontend/web/src/components/CompareBranchStrip.tsx`: compact twin-column UI wired to the same selection state as the navigator and findings diff
- `src/frontend/web/src/components/ClickableRow.tsx` + `ReferenceCopyButton.tsx`: shared row navigation + copy affordances without nested `<button>` markup; `ClickableRow` supports `selected` + `selectedEmphasis` (`fill` vs `accent-bar`) for Compare rows that sit on tinted backgrounds, and optional **`onPointerIntent`** (mouse enter + focus) for lightweight prefetch hooks (Phase 48 Compare pair heavy chunk)

Raw node ids remain available via optional “debug” details, but primary surfaces prefer human-readable labels.

Join/branch naming (Phase 13):
- Join-family operators get branch-aware labels and subtitles derived from child structure:
  - Hash Join: build (hash child input) vs probe (left child)
  - Nested Loop / Merge Join: outer vs inner (left/right)
- Subtitles optionally include a concise join condition snippet when present.
- Guardrail: when child structure is ambiguous, the UI falls back to left/right rather than fabricating certainty.

Side-attributed join hints (Phase 14):
- Goal: when and only when evidence is explicitly side-scoped, the UI and compare evidence lines can attribute change to a join side.
- Semantics:
  - Hash Join: `contextDiff.hashBuild` is treated as **build-side** evidence (child `Hash` build characteristics).
  - Nested Loop: `contextDiff.nestedLoop.innerSideWaste` (when present) is treated as **inner-side** evidence (propagated from inner scan waste); otherwise only a conservative `inner pressure` hint is emitted from amplification direction.
- Guardrails:
  - No side attribution is emitted for joins unless the underlying evidence model is inherently side-scoped (e.g., Hash build, inner-side waste).
  - Merge Join currently avoids side attribution to prevent guessing.

Narrative/hotspot presentation + query text (Phase 15):
- Backend narrative hotspot strings avoid internal node ids by formatting hotspot references with operator/relation-aware labels.
- Frontend renders hotspots as structured, clickable “inspect next” items derived from `PlanSummary.top*HotspotNodeIds` + the presentation label system.
- Optional query text can be supplied on analyze; it is returned in `PlanAnalysisResult` and surfaced in reports and the Analyze UI as a collapsible “Source query” section.

Analyze and Compare share-links are backed by a **local SQLite file** (configurable path; Docker mounts a volume on `/app/data` by default). **Phase 37** adds optional **auth + per-artifact ACL** (`StoredArtifactAccess`: owner, scope, groups, link flag) while keeping **non-auth mode** as the default (capability URLs, no identity). See [Deployment & auth](deployment-auth.md). Docker Compose runs both services locally with a named volume so ids can survive container restarts when the volume is kept.

## Architecture diagrams

### Analysis pipeline

```mermaid
flowchart LR
  A[EXPLAIN JSON] --> B[PostgresJsonExplainParser]
  B --> C[NormalizedPlanNode tree]
  C --> D[DerivedMetricsEngine]
  D --> E[AnalyzedPlanNode list]
  E --> F[FindingsEngine]
  E --> G[OperatorEvidenceCollector]
  F --> H[PlanSummaryBuilder]
  H --> I[NarrativeGenerator]
  E --> OS[OptimizationSuggestionEngine]
  F --> OS
  H --> R[PlanAnalysisResult]
  I --> R
  OS --> R
  R --> J[API response]
  J --> K[Analyze UI]
  K --> L[presentation/* helpers]
```

`IndexSignalAnalyzer` (overview + bounded insights) feeds both findings-related UI and `OptimizationSuggestionEngine` in code; the diagram keeps the spine readable.

### Compare pipeline

```mermaid
flowchart LR
  A[Plan A text or JSON] --> AA[AnalyzeAsync]
  B[Plan B text or JSON] --> BB[AnalyzeAsync]
  AA --> C[ComparisonEngine]
  BB --> C
  C --> D[NodeMappingEngine]
  C --> E[Node deltas + pair details]
  E --> F[ContextEvidenceDiffSummarizer]
  E --> G[Findings diff]
  C --> H[Narrative + reports]
  C --> COS[CompareOptimizationSuggestionEngine]
  COS --> I[Compare UI]
  E --> I
  H --> I
```

Phase 36: each analyze half can carry optional **`queryTextA`/`queryTextB`**, **`explainMetadataA`/`explainMetadataB`**, and **`PlanInputNormalizationInfo`** per side; **`POST /api/compare`** persists **`PlanComparisonResultV2`** and returns **`comparisonId`**; **`GET /api/comparisons/{id}`** reloads the snapshot.

### Operator evidence propagation

```mermaid
flowchart TD
  A[AnalyzedPlanNode] --> B[OperatorEvidenceCollector]
  B --> C[OperatorContextEvidence]
  C --> D[Attached on analyzed nodes]
  D --> E[PairDetails contextEvidenceA/B]
  E --> F[ContextEvidenceDiffSummarizer]
  F --> G[contextDiff.highlights]
  G --> H[Badges + side-aware hints]
```

### Presentation layer

```mermaid
flowchart TD
  A[API models] --> B[presentation/nodeLabels]
  A --> C[presentation/contextBadges]
  A --> D[presentation/joinPainHints]
  A --> E[presentation/hotspotPresentation]
  A --> F[presentation/artifactLinks]
  B --> P[AnalyzePage / ComparePage]
  C --> P
  D --> P
  E --> P
  F --> P
```

Phase 33: **`presentation/artifactLinks.ts`** centralizes query keys (`pair`, `finding`, `indexDiff`, `suggestion`, **`analysis`**, **`comparison`**, `node`), `buildCompareDeepLinkSearchParams` / `buildAnalyzeDeepLinkSearchParams`, and `scrollArtifactIntoView` for `data-artifact` targets. Compare syncs a small set of params from selection.

Phase 34: optional **`ExplainCaptureMetadata`** on analyze request/response; **`PlannerCostAnalyzer`** fills **`PlanSummary.PlannerCosts`** from parsed nodes; **`presentation/explainCommandBuilder.ts`** + **`explainMetadataPresentation.ts`** support the Analyze “Suggested EXPLAIN” UI. Analyze **`?node=`** is kept in sync with selection (deduped `replace` updates).

Phase 35: **`PlanInputNormalizer`** (Core) + **`PlanInputNormalizationInfo`** on **`PlanAnalysisResult`**; API prefers **`planText`** for analyze; shareable **`?analysis=`** + **`?node=`** URL model, **Copy share link**, inline normalization status.

Phase 36: **SQLite** artifact store for analyses and comparisons; **`GET /api/analyses/{id}`** / **`GET /api/comparisons/{id}`** read durable JSON payloads; optional **`Storage:ArtifactTtlHours`** and **`Storage:MaxArtifactRows`**; Compare **`planAText`/`planBText`**, per-side query text + **`ExplainCaptureMetadata`**, UI **Plan capture / EXPLAIN context** (A vs B), **`?comparison=`** + **Copy share link** parity with Analyze.

Phase 38: **JWT** and **API key** identity modes ( **`JwtBearer`**, **`ApiKey`** ) with stable **owner ids**; legacy **`BearerSubject`** unchanged; **`GET /api/config`** exposes **`authIdentityKind`** + **`authHelp`**; optional **`RateLimiting`** on POST endpoints.

Phase 39: **Analyze workspace UX** — narrative, hotspots, top findings, and suggestion **previews** sit in a **Plan guide** rail adjacent to the graph on wide viewports; **compact selection snapshot** mirrors graph/hotspot/finding clicks; full findings and **Selected node** detail remain below with **`<details>`** for workers, raw JSON, derived metrics, and operator context to reduce vertical noise; graph height is **responsive** (`AnalyzePlanGraph` `graphHeight` prop).

Phase 40: **Analyze decomposition + layout preferences** — **`AnalyzePage`** orchestrates extracted panels under `components/analyze/`; **`analyzeWorkspace/analyzeWorkspaceModel.ts`** defines **`AnalyzeWorkspaceLayoutState`** (visibility, guide section order, lower-band column order, presets); **`useAnalyzeWorkspaceLayout`** persists to **localStorage** and optionally **`/api/me/preferences/analyze_workspace_v1`** when auth + client credentials are present; API adds **`IUserPreferenceStore`** / **`SqliteUserPreferenceStore`** + **`user_preference`** table in the artifact SQLite file. The model is page-keyed and versioned so Compare can reuse the same persistence pattern later.

Phase 41: **Compare workspace parity** — typed **`CompareWorkspaceLayoutState`**, **`useCompareWorkspaceLayout`**, **`components/compare/*`**, and **`compare_workspace_v1`** preference key mirror Analyze’s customization story.

Phase 42: **Workspace density + responsive tiers + richer reorder** — **`useWorkspaceLayoutTier`** (`narrow` / `medium` / `wide` at **900px** and **1320px**) drives Analyze and Compare grids; **`WorkspaceSortableOrderList`** adds handle-based **drag-and-drop** reorder with **Up/Down** keyboard-friendly fallback; expanded **presets** (**Wide graph**, **Reviewer**, **Compact** on Analyze; **Wide pair** / **`wideGraph`** on Compare). Coercion helpers (**`coerceAnalyze*`** / **`coerceCompare*`**) keep stored JSON valid when merging.

Phase 43: **Visual workstation system** — **`index.css`** tokens (**`--surface-*`**, text rungs, elevation, focus ring) and **`workstation.css`** (**`pqat-*`** utilities: panels, buttons, segmented toggles, chips, metric tiles, graph frame, customizer well). **`App.tsx`** uses **`NavLink`** for active route styling; findings use severity **chip** colors; shell **topBar** uses backdrop blur and pill links.

Phase 44: **Patterns + delivery** — **`workstation-patterns.css`** holds dense layout/form/callout primitives (grids, capture stack, navigator pair rows, summary shell, route fallback). **`App.tsx`** lazy-loads **`AnalyzePage`** / **`ComparePage`** with **`Suspense`**; workspace customizers mount **`WorkspaceSortableOrderList`** (**@dnd-kit**) only after **Customize workspace** opens via **`React.lazy`** inner modules. Vitest **`setup.ts`** preloads inner modules so Suspense resolves in jsdom.

## Data flow

Raw pasted `planText` (optional `psql` wrapper / `+` wraps)
→ **`PlanInputNormalizer`** (Phase 35) → JSON string
→ `JsonDocument.Parse` / legacy `plan` body

Raw plan JSON
→ `PostgresJsonExplainParser` (normalize)
→ `DerivedMetricsEngine` (annotate)
→ `FindingsEngine` (rules + ranking)
→ `PlanSummaryBuilder` + `NarrativeGenerator`
→ `PlanAnalysisResult` (API response, report input, UI model)

Operator Depth v2 (Phase 9):
- The parser/normalized model also captures operator-specific fields (sort/hash/parallel/waste/cache) when present.
- These fields flow through analysis unchanged and are consumed by:
  - findings evidence (stronger, more concrete explanations)
  - compare pair detail (side-by-side operator specifics)
  - diagnostics and narrative (grounded hints)

Operator evidence propagation (Phase 10):
- `DerivedMetricsEngine` attaches compact `contextEvidence` per analyzed node via `OperatorEvidenceCollector`.
- Context evidence is curated and bounded (nearby descendants only) to avoid flooding payloads.
- Consumers:
  - findings rules can reference contextual evidence to explain parent operators using child/subtree signals
  - compare pair details expose `contextEvidenceA/B` for side-by-side context inspection
  - narrative/reports can cite short contextual hints when present

Context evidence diff summarization (Phase 11):
- `ComparisonEngine` computes `contextDiff` per matched pair from `contextEvidenceA/B`.
- `contextDiff.highlights` is the primary “what changed” signal for:
  - compare selected-pair UX (Context change summary)
  - compare narrative
  - compare markdown report
This keeps summaries bounded and avoids dumping raw context into prose.

## Comparison pipeline

Plan A text/JSON + Plan B text/JSON (optional per-side query + explain metadata)
→ analyze A + analyze B (same pipeline as above; per-side normalization when text path used)
→ `NodeMappingEngine` (heuristic mapping + confidence)
→ `ComparisonEngine` (per-node deltas, improved/worsened areas, findings diff with **`diffId` (`fd_*`)** + id-based cross-links, **index comparison** via `IndexComparisonAnalyzer` with **`insightDiffId` (`ii_*`)**, **`FindingIndexDiffLinker`** for reciprocal **ids** (legacy index arrays retained), pair **`pairArtifactId` (`pair_*`)**, **corroboration cues**, evidence-based narrative, pair details with **index delta cues**, **`BottleneckComparisonBrief`**, Phase 60 **`ComparisonStory`**)
→ `PlanComparisonResultV2` (API response, UI model, compare report input; includes `IndexComparison` summary, **`comparisonStory`**, **`bottleneckBrief`**)

Diagnostics mode (optional):
- `POST /api/compare?diagnostics=1` includes bounded candidate + decision diagnostics (winner factors + near-misses).

Compare reports:
- `POST /api/compare/report/json` returns the structured comparison object (optionally with diagnostics).
- `POST /api/compare/report/markdown` returns a human-readable compare report (top pairs + key findings changes + limitations).

