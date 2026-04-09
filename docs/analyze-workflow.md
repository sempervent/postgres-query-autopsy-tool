# Analyze Workflow

## Input

1. Paste plan output: **plain EXPLAIN JSON** or typical **`psql` QUERY PLAN** cell text (header, separators, `(N rows)`, `+` wraps—see [Capturing EXPLAIN JSON](capturing-explain-json.md)). Prefer `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` when you need forensic evidence; planner **`COSTS`** are optional.
2. Optionally paste the source SQL query text (stored on the server with the analysis when provided).
3. Optionally expand **Suggested EXPLAIN command** to generate copy-paste SQL (toggles for `ANALYZE`, `VERBOSE`, `BUFFERS`, and explicit `COSTS true`/`false`) and, if **Send EXPLAIN options with analyze request** is checked, attach declared options plus an optional “recorded command” to the API payload (`explainMetadata`).
4. Click **Analyze**.

## In-product workflow guide (Phase 101)

- **Distinct help chrome:** **`help/helpSurface.css`** (dotted border, teal accent rail, “Guide — not plan analysis” kicker) is intentionally **not** the same surface family as **`pqat-panel`** findings/workspace cards.
- **Entry points:** **`How to use Analyze` / `Hide guide`** toggles the **`AnalyzeWorkflowGuide`** panel; it opens automatically on an empty page and after **Clear**, stays closed while a snapshot or share link is open, and can be reopened anytime.
- **Context hints:** **`pqat-help-inline`** callouts sit beside **Input plan** and **Graph/Text** mode (capture vs interpretation—read the guide for definitions, not the forensic panels).

## Workflow guide persistence & re-entry (Phase 102)

- **Dismissal:** Hiding the guide on an empty Analyze page sets **`analyzeDismissed`** in **`localStorage`** key **`pqat_workflow_guide_v1`** (`{ v: 1, analyzeDismissed?: boolean, compareDismissed?: boolean }`). The next empty visit starts with the guide **closed** until the user clicks **How to use Analyze**, presses **`?`** or **Shift+/** (when focus is **not** in **`input` / `textarea` / `select` / `contenteditable`**), or opens **`/?guide=1`** or **`/?guide=true`**.
- **Clear:** **Clear** always reopens the guide for a fresh capture pass (without clearing the stored dismissal flag for future empty visits).
- **Deep link:** **`?guide=`** is removed from the URL when the user **closes** the guide after it was opened via that param, so refresh does not keep forcing it open.
- **Plan guide rail:** **`pqat-help-inline`** under **Plan guide** reminds users the rail is interpretation layered on the plan, not raw EXPLAIN output.

## Help lifecycle, focus, and support entry (Phase 103)

- **Focus:** When the guide opens from **How to use…**, **`?`**, or **`?guide=1`**, focus moves to the guide **`h2`** (programmatic focus, **`tabIndex={-1}`**). Auto-open on first empty visit and **Clear** do **not** steal focus from the plan field.
- **Close:** **Esc** closes the guide when the event target is **not** an **`input` / `textarea` / `select` / `contenteditable`** (same ignore rule as **`?`**). After an explicit close (**Hide guide** or **Esc**), focus returns to the bar toggle.
- **Support:** **Copy guided link** (guide footer) copies **`{origin}{path}?guide=1`** only—distinct from **Copy share link** on a saved analysis.
- **E2E:** Playwright proves **`localStorage`** dismissal survives **reload** and that **`?guide=1`** still reopens; clipboard + **Esc** + focus return are covered in **`persisted-flows.spec.ts`**.

## Help accessibility and guided-link merge (Phase 104)

- **Screen readers:** **`data-testid="analyze-workflow-guide-announcer"`** ( **`aria-live="polite"`**, **`aria-atomic="true"`** ) announces explicit open (**“Analyze workflow guide opened”**), close (**“…closed”**), and **“Guided help opened from link”** when **`?guide=`** opens the panel. Auto-open on first empty visit does not announce. Copy is cleared after a few seconds to limit noise.
- **Tab loop:** After an **explicit** open (**How to use…**, **`?`**, **`?guide=`**), **Tab** / **Shift+Tab** wrap between the first and last focusable inside **`pqat-help-shell`** (capture listener on the section). **Clear** / empty-state auto-open does not enable the loop. **Esc** and non-modal behavior unchanged.
- **Copy guided link:** **`buildCopyGuidedLinkUrlFromLocation`** sets **`guide=1`** on the live **`window.location`** (path + search + hash), preserving other params—distinct from **Copy share link** on a saved analysis.

**Local vs reopened analysis:** Pasting and analyzing keeps the raw text in the browser until you clear it. After success, the address bar gains **`?analysis=<opaqueId>`** (and **`node=`** when a node is selected) so the same result can be fetched again from **SQLite-backed** storage. Opening a URL with **`analysis=`** loads the snapshot from the server (`GET /api/analyses/{id}`) and clears the textarea; running **Analyze** again on new paste strips the old `analysis` query param and replaces it after the new response. Responses include **`artifactSchemaVersion`** (Phase 49); the server normalizes older stored JSON on read. If the snapshot is **missing**, **access denied**, **corrupt** (**422**), or from an **unsupported newer schema** (**409**), the page shows a specific message instead of a generic failure. **Copy share link** (non-auth) or **Copy artifact link** (auth deployments) reflects server policy—see [Deployment & auth](deployment-auth.md). Links remain valid across API restarts if the database file is kept (see [API & Reports](api-and-reports.md#storage-phase-36-access-control-phase-37)).

**Phase 72 + 84 + 86 (copy reliability + ticket payloads):** **`copyToClipboard`** tries **`document.execCommand('copy')` on a hidden textarea first** (same synchronous turn as the click, so Safari / strict Chromium user-gesture rules still work), then falls back to **`navigator.clipboard.writeText`**. **`useCopyFeedback`** shows success or an honest **copy-failed** hint; status lines use **`role="status"`** + **`aria-live="polite"`** + **`aria-atomic="true"`** on copy feedback, with a slightly longer success dwell time for assistive tech (**Phase 86**). **`ClickableRow`** ignores clicks that originate on nested **`button`** / **`a`** / **`[data-pqat-row-no-activate]`** so copy does not flip navigator selection. **`nodeReferenceText`** / **finding** / **hotspot** copies prepend **`PQAT analysis: <id>`** when scope is known; **share link** copy uses a **multi-line** block (**URL** + **`PQAT analysis:`** + optional **`Node:`**) via **`analyzeDeepLinkClipboardPayload`**. **Optimization suggestions** use **`suggestionReferenceText`** (legacy string **`analysisId`** or structured context). Playwright smoke records payloads from **`writeText`** and **`execCommand('copy')`** and asserts **node reference**, **suggestion ticket copy**, **Analyze share link** (**`PQAT analysis:`**), **suggested EXPLAIN**, **Compare pair reference**, **Compare deep link**, and **Compare suggestion Copy for ticket** blocks (**Phase 87**). Backend **`PostgresJsonAnalyzeFixtureSweepTests`** exercises the full **`PlanAnalysisService`** pipeline over every top-level **`fixtures/postgres-json/*.json`** (see [Fixtures](fixtures.md)).

See [Capturing EXPLAIN JSON](capturing-explain-json.md) for recommended commands, share-link behavior, and normalizer caveats.

## Analyze workspace (Phase 39 + Phase 42)

After **Analyze** succeeds, the page is organized as an **investigation workstation** instead of one long vertical stack:

1. **Input / actions** — paste, suggested EXPLAIN, **Analyze**, exports, optional **Sharing** when auth is enabled.
2. **Summary + metadata** — compact summary line, **Plan briefing** (Phase 60–64 + **82** + **83**: story lanes use human-first labels—**what the plan is doing**, **where work piles up**, **what is driving cost**, **Start here** as an **ordered list** when **`inspectFirstSteps`** is present, else the legacy single paragraph). Step 1 may include **Focus in plan** when the backend attached **`focusNodeId`**. The path still points at ranked **Optimization suggestions** in the guide instead of pasting the top card (**Phase 82** dedup). **Markdown/HTML exports** mirror the structured list when steps exist (**Phase 83**). When source SQL mentions **`time_bucket`**, the index/shape lane may append a bounded analytical hint (feeds/scans vs finalize hop). **Plan source / EXPLAIN metadata** and share/artifact copy when applicable. **Phase 92:** canonical **`e2e-visual`** PNG for this story surface uses **`data-testid="analyze-visual-summary-contract"`** (metrics + **Plan briefing** block only), not the full card—see **`e2e/visual/README.md`**.
3. **Plan workspace** — the graph (or text tree) is the visual center. **Responsive tiers** (`useWorkspaceLayoutTier`): **narrow** (&lt;900px) stacks the guide **below** the graph; **medium** (900–1319px) keeps **graph + Plan guide** side-by-side with slightly different column weighting than **wide** (≥1320px), which gives the graph and investigation surface more horizontal room. **Phase 97:** on **medium/wide** when the guide is visible, the workspace grid row uses **`pqat-analyzeWorkspaceRow--paired`** so the **Plan workspace** panel and **Plan guide** share the **same row height** (no short capped rail beside a tall graph). The guide uses **`besideWorkspace`** chrome: fixed **Companion / Plan guide** header, **`overflow-y: auto`** on the body; the graph can **`flex`** to fill the remaining column height (`**graphFillColumn**` on **`AnalyzePlanGraphCore`**). **Narrow** keeps **`stacked`** rail behavior with a bounded **`max-height`** scroll on the whole aside. The **left** column holds plan mode toggles, search boxes, fit/focus/reset, and the tree or graph; the **right** column (when visible) is the **Plan guide** rail with:
   - **Focused operator** readout when a node is selected: human-readable title, **Phase 63–64** backend **`operatorBriefingLine`**, **Phase 82** **Bottleneck posture** strip when this node appears on a ranked bottleneck (primary vs stacked rank + class chip + headline), join/branch subtitle when applicable, metrics, longer **What this operator is doing** interpretation, findings cue, and a collapsed **Technical id** for the canonical planner path
   - **Plan narrative** — **Orientation** lane: **`planStory.planOverview`**; **What happened** lane: clamped `narrative.whatHappened`; **Propagation & flow** lane: propagation beats with **Focus** (human **`anchorLabel`**, not a raw path)
   - **Main bottlenecks** (Phase 58–62) — triage-style cards: rank + class + kind + cause chips, headline/detail, optional symptom (nested-loop inner **or** hash-build side when inferable) and propagation line; **`humanAnchorLabel`** drives **Focus**. **Phase 67:** **`OperatorNarrativeHelper`** enriches **nested-loop** bottleneck copy when the **inner child** shows high **`Actual Loops`** (especially **Seq Scan** on the inner relation), and inner-side symptom notes call out **repeated inner execution** with measured loop counts. **Phase 68–71 (Compare-facing):** when you compare **before/after** plans, the same **Sort** / **Seq Scan** / **Index Scan** / **bitmap** / **index-only** / **aggregate** / **gather-merge** anchors feed **`regionContinuityHint`**, **`regionContinuitySummaryCue`**, and optional **`continuityKindKey`** on mapped pairs—Analyze copy is unchanged, but saved comparisons benefit from the richer **access-path**, **ordering** (including **query-text ORDER BY** tie-breaks), **GROUP BY / time_bucket**-bounded SQL hints for grouping continuity, and **output-shaping** continuity described in [Compare workflow](compare-workflow.md).
   - **Where to inspect next** — **Phase 82:** short pointer to **Snapshot → Plan briefing → Start here** (full numbered text is not duplicated here), then **hotspot** rows (click/keyboard selects the node; **Copy** stays separate)
   - **Top findings** — a compact preview (not a replacement for the full list below)
   - **Next steps** — a short preview of the top **optimization suggestions**; full ranked cards (priority → confidence, **Try first** styling, **Strongest next experiment** callout) live in the lower workspace (**Phase 82**). Cards linked to a bottleneck show a **Bottleneck #N** chip that jumps to the bottleneck anchor in the plan (**Phase 83**), plus the **Because of bottleneck** line when it resolves.
   - **Source query** — optional, folded in a `<details>` block in the rail when query text exists

   On **narrow** viewports the rail **stacks under** the graph so the flow remains a single column.

   **Phase 98:** In **`besideWorkspace`** mode, when **Selection snapshot** is part of the guide (**`selection`** in **`guideSectionOrder`**), the **Focused operator** block is rendered in **`pqat-planGuideRail__stickyBand`** between the **Plan guide** title and the scrollable body so the live selection readout stays visible while narrative, bottlenecks, and lower sections scroll.

   **Phase 99:** **Text** plan mode uses **`pqat-planTextTreeBand`** when the workspace is **paired** with the guide—a bounded-height, bordered scroll surface so the tree occupies the shared row like the graph canvas. The scrollable guide body is named **`Plan guide — scrollable sections`** for assistive tech when **`besideWorkspace`**. **Phase 100:** **`flex: 1 1 0`** on the text band improves flex sizing inside the shared paired row.

4. **Findings, suggestions, and selected node** — below the plan workspace, a second band keeps the **full findings** list on one side and the **full optimization suggestions** plus **selected node** detail on the other. The **Selected node** panel shows the primary label, **Phase 63–64** **`operatorBriefingLine`** when present, then an operator-level **What this operator is doing** readout when `operatorInterpretation` is present (Phase 59, derived from `OperatorNarrativeHelper`), then cues and actions; the heaviest blocks load as a **lazy sub-chunk** (Phase 45). **Plan guide · Main bottlenecks** cards (**Phase 64**) repeat the same **`operatorBriefingLine`** under a **Briefing** kicker when the backend attached it. **Optimization suggestions** may show a **Because of bottleneck** line when `relatedBottleneckInsightIds` resolves to a ranked bottleneck. Within the lazy chunk, **`<details>`** still progressive-discloses **operator context**, **workers**, raw JSON, and metrics.

The graph panel uses a **viewport-relative height** when the guide is hidden or on **narrow** (clamped min/max) so small plans do not leave a huge empty band under the canvas; when **paired** with the guide, the canvas **grows with the shared row** instead of stopping short while the rail was previously **`max-height`**-capped (**Phase 97**). Graph behavior (search highlight, collapse, fit, focus, URL **`?node=`** sync, copy reference/link) is unchanged in intent.

## Workstation presentation (Phase 55)

- **Empty capture:** “Ready to analyze” lead-in plus short guidance before the first run.
- **Errors / reopen:** Banners classify **access denied**, **artifact corrupt / schema mismatch** (422/409), and generic failures; persisted loads use a dashed **loading** banner.
- **Summary deck:** The snapshot card uses a top **signal strip** (accent gradient), **`Outfit`** + **IBM Plex Sans** typography (see `index.html`), and the same metric grid rhythm as before.
- **Findings:** Selected rows prefer a **left accent bar** (`ClickableRow` **`accent-bar`**) instead of only a flat fill.
- **Suggestions:** **Try next** is the primary signal line when it adds information beyond the summary; chips emphasize **priority** and **confidence**, with a scan-friendly **action lane** (experiment / validate / shape). The top high-priority card is visually highlighted (**Phase 82**).
- **Sharing (auth):** **Sharing & access** is a framed **`<details>`** with **`pqat-*`** form controls and an inline **info** strip summarizing **`authHelp`** + Vite env hints.

Motion: light **fade-in** on heavy panels and banners; **`prefers-reduced-motion: reduce`** disables shimmer/fade loops globally (`index.css`).

## Appearance / theme (Phase 65–66)

- **Top bar → Theme appearance:** **System** (default), **Dark**, or **Light**. **System** shows a compact **→ Dark** / **→ Light** hint for the **resolved** skin and exposes screen-reader text via **`aria-describedby`**. **System** tracks **`prefers-color-scheme`** live (not frozen at first load).
- **Persistence:** **localStorage** key **`pqat_theme_v1`**. When the API reports **`authEnabled: true`** and the SPA is built with **`VITE_AUTH_*`** credentials, the same preference string is also stored under **`/api/me/preferences/appearance_theme_v1`** (debounced **PUT** after changes, **GET** hydrate on load — same mechanism as workspace layout keys). Non-auth deployments stay local-only.
- **Rendering:** **`html[data-theme]`** is the skin selector for CSS; **`html[data-effective-theme]`** duplicates the resolved value as a stable test/debug hook. The **`index.html`** boot script sets both before React hydrates.
- **Readouts:** Plan briefing, bottlenecks, selected-node **Briefing**, story lanes, join badges, and banners use shared **`--pqat-*`** tokens so hierarchy stays clear in both skins.
- **Testing:** Playwright **`e2e/theme-appearance.spec.ts`** runs under **`e2e-smoke`** and checks **`data-theme-preference`**, **`data-effective-theme`**, reload persistence, and **`emulateMedia`** behavior for **System**.

## Visual hierarchy (Phase 43)

Regions use a shared workstation style: **capture** and **summary** panels read as lighter “chrome”; **plan workspace** is the elevated investigation surface; **findings** and **selected node** use detail panels with clearer typography rungs; severity and confidence appear as **chips**; the **Plan guide** rail is visually distinct from the graph column. This does not change analysis behavior or layout persistence.

## Delivery & patterns (Phase 44)

The **Analyze** route is **code-split** (`React.lazy` + `Suspense`); the shell shows a short **Loading Analyze…** placeholder while the page chunk loads. **`workstation-patterns.css`** groups dense layout utilities (form grids, capture stack, route fallback) so **`workstation.css`** stays focused on core controls. **Customize workspace** loads the **drag-and-drop** reorder lists only after you first open the **`<details>`** (further shrinking the initial Analyze chunk until customization is needed).

## Progressive loading & performance (Phase 45)

After the route chunk loads, the page still **stages** heavy UI:

1. **Graph vs text** — In **Text** mode, the **React Flow** bundle is not required; switching to **Graph** loads **`AnalyzePlanGraphCore`** behind **`PlanGraphSkeleton`**. The tool **prefetches** that chunk on **Graph** hover/focus and on **idle** when you are already in graph mode so the first paint of the canvas is usually quick.
2. **Lower band** — **Findings**, **optimization suggestions**, and **selected node** are separate **lazy** modules with a shared **`LowerBandPanelSkeleton`** (**`HeavyPanelShell`**) so capture + summary + plan workspace can appear before those panels’ JS parses.
3. **Long lists** — Findings and optimization suggestions use **`VirtualizedListColumn`** (**`@tanstack/react-virtual`**) when the filtered list is long (short lists stay a simple column; row heights can grow when **Evidence** `<details>` expand). **Phase 48:** when optimization suggestions are **grouped by family**, long lists **flatten** into virtual rows (**section header** + **card**) so family subheadings are not skipped; **`getItemSize`** supplies shorter estimates for header rows than cards.
4. **Selected node** — The panel header (label, worker cue, index insight, copy actions) renders first; **operator context**, **buffer I/O**, **workers** grid, **raw JSON**, **metrics JSON**, and the **findings-for-node** bullet list live in **`AnalyzeSelectedNodeHeavySections`**, loaded lazily with an inline skeleton.

URL sync (**`?node=`**), selection, and copy behavior are unchanged; tests preload graph and lower-band modules in **`setup.ts`** so jsdom does not stick on **Suspense** fallbacks.

## Customize workspace (Phase 40 + Phase 42)

The Analyze UI is split into **typed panels** (capture, summary, plan workspace, plan guide, findings, optimization suggestions, selected node). Use **Customize workspace** (under **Plan workspace**) to:

- **Presets:** **Balanced** (default), **Wide graph** (hides plan guide rail), **Reviewer** (findings → selected node → suggestions in the lower band), **Focus** (hides suggestions region), **Detail** (suggestions before findings), **Compact** (hides summary, guide, and suggestions for a denser tree-first view).
- **Visibility:** show or hide each major panel. If **plan capture** is hidden, a **Show input** strip appears so you can recover it.
- **Plan guide section order:** **drag** the handle or use **Up/Down** to reorder blocks (selection snapshot, what happened, **main bottlenecks**, hotspots, top findings, next steps, source query).
- **Lower band column order:** same **drag** + **Up/Down** pattern for **findings**, **optimization suggestions**, and **selected node**; wide screens show columns side-by-side, medium/narrow wrap or stack by tier.

**Persistence:** layout is stored in **`localStorage`** under **`pqat.analyzeWorkspaceLayout.v1`** (versioned JSON). When the API reports **`authEnabled`** and the SPA is built with **`VITE_AUTH_API_KEY`** or **`VITE_AUTH_BEARER_TOKEN`**, the same layout is **loaded from and saved to** **`GET`/`PUT /api/me/preferences/analyze_workspace_v1`** after hydrate (debounced saves). If auth is off or the request fails, **local layout still applies**.

Implementation reference: `src/frontend/web/src/analyzeWorkspace/*`, `src/frontend/web/src/components/analyze/*`, slim **`AnalyzePage.tsx`** orchestration.

## Reading the results

### Hotspots (“Where to inspect next”)

Hotspots are rendered as clickable items that select the corresponding node. On desktop they also appear in the **Plan guide** rail beside the graph (see above) so guidance stays next to the plan view.

- **exclusive runtime**: local operator work dominating time
- **subtree runtime**: work dominated by descendants
- **shared reads**: I/O hotspots (requires `BUFFERS` in the input JSON)

PostgreSQL includes buffer counters as **flat** properties on each plan node in JSON (for example `"Shared Read Blocks"`, `"Temp Written Blocks"`), not only under a nested `"Buffers"` object. The parser accepts both shapes. Per-worker buffer lines under a `"Workers"` array are merged onto the parent node when the leader omits those totals, so `summary.hasBuffers` and read hotspots can still light up for parallel plans. The same `Workers` entries are also preserved as a typed `workers` list on that node in the API response (per-worker timing, rows, loops, and buffer counters), separate from the parent’s aggregate fields when PostgreSQL provides both.

Each hotspot row also includes a subtle **Copy** action that copies a concise, human-readable node reference (optionally annotated as a hotspot).

**Interaction model:** the row is one keyboard-focusable target (click or Enter/Space) to select the node. **Copy** is a separate button so the row is not nested invalid markup.

### Findings

Findings are ranked by severity/confidence and tied to nodes. Use the node anchor label to jump into the plan tree.

Finding rows also include a subtle **Copy** action that copies a concise human-readable reference for the anchored node (optionally suffixed with the finding title).

**Interaction model:** same as hotspots—the row selects the anchor node; **Copy** is a separate control.

**Index tuning:** findings and structured `indexInsights` distinguish (a) **likely missing / worth-investigating index** on selective seq scans (F, J), (b) **index or bitmap path still heavy** (R), (c) **bitmap recheck** review (S), (d) **chunked bitmap + Append** workloads where indexes likely exist but aggregate I/O stays large (P), (e) **nested-loop inner** index alignment (Q, and E for high amplification), and (f) **sort** hotspots with optional order/index hints (K). None of these assert a specific DDL.

### Optimization suggestions (Phase 32 + Phase 47)

**Findings** explain *what looks wrong* and attach evidence. **`optimizationSuggestions`** are a separate, ranked list of *investigation-oriented next steps*: index experiments, query-shape or ordering ideas, statistics maintenance, join/hash/sort volume reductions, parallelism skew checks, Timescale/chunk workload guidance, and explicit “observe before change” validation.

- Suggestions are **evidence-linked** (`relatedFindingIds`, `relatedIndexInsightNodeIds`, `targetNodeIds`) and include **`suggestionId`** values with the **`sg_`** prefix (deterministic content hash). Compare-only payloads may also include **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`** on suggestions. Fields include **confidence**, **priority**, **cautions**, and **validation steps**.
- **Phase 47 — human-readable payload:** each suggestion also carries **`suggestionFamily`** (UI grouping: index experiments, query shape & ordering, statistics & planner accuracy, schema & workload shape, operational tuning & validation), **`recommendedNextAction`** (short imperative), **`whyItMatters`** (plain impact), optional **`targetDisplayLabel`** (human operator/relation phrasing—avoid raw node paths in primary copy), and **`isGroupedCluster`** when multiple overlapping statistics-style findings were **consolidated** into one card. **Title** and **summary** stay user-facing; **details** / **rationale** hold denser evidence.
- They are **not prescriptions**: the tool does not emit guaranteed `CREATE INDEX` DDL. Language stays conservative (especially for **P** chunked-bitmap plans, where naive “add another index” advice is suppressed in favor of window pruning, ordering, aggregates, and retention-style investigation).
- The **Plan guide** rail shows a **preview** of top suggestions (family · confidence · priority, summary, **Next ·** line when present, **Focus …** using **`targetDisplayLabel`** when the API provides it). The **full** list in the lower band uses **separate metadata chips** (readable phrases like “High confidence”, not `Confidence: high` jammed into titles). Long lists may show **family subheadings** when that improves scanability; validation lines are phrased as experiments, not boilerplate. **Phase 48:** **`normalizeOptimizationSuggestionsForDisplay`** backfills missing Phase 47 fields when reopening **older stored** analyses (family inferred from category, **Next** / **Why** from validation/rationale, **`targetDisplayLabel`** from the first target node id when absent)—no forced re-analyze.
- The **Selected node** panel may show the **strongest related suggestion** when any suggestion lists that `nodeId` in `targetNodeIds` (title, summary, and **Next ·** when present).

### Plan index posture (summary card)

After analyze, the summary card can show an **Index posture** line from `indexOverview`: scan mix (seq vs index vs bitmap counts) or, for Append + many bitmap heaps, an explicit note that **per-chunk index use may already be happening** while total reads/temp work can still dominate.

### Selected node

The **selection snapshot** in the Plan guide rail gives an immediate, compact readout when you click the graph, hotspots, findings, or suggestions. The **full** selected node panel (lower section) shows:

- human-readable label
- join/branch subtitle when applicable
- optional side-aware context line when supported by evidence
- **Copy reference** (human-readable node text) and **Copy link** (full URL with `?node=<nodeId>` for the current selection). **Phase 34:** the address bar stays in sync: selecting a node updates `?node=` (replace history, deduped), loading a URL with a valid `node=` restores selection after analyze, and browser back/forward updates the selected node when the id still exists in the current result.
- **Related optimization suggestion** (when a ranked `optimizationSuggestions` entry targets this `nodeId`): title, summary, and optional **Next ·** line, to avoid duplicating the full suggestions list
- **Access path / index insight** (when `indexInsights` entries target this `nodeId`): compact headline, access-path family, and signal kinds (investigation-oriented, not prescriptions)
- **Buffer I/O**: when this node has any shared/local/temp buffer counters in the API payload (including explicit zeros), a short labeled list is shown above the raw JSON dump; if the plan has buffers elsewhere but this operator has none, a one-line hint explains that
- **Workers** (parallel plans): when the node has a non-empty `workers` array, a one-line **worker summary** (count and conservative read/time/temp cues when applicable) plus a compact per-worker grid (worker id, total time, rows, shared hit/read, temp read/write). Parent row buffer/timing fields remain the leader aggregate when PostgreSQL reports them; worker rows are the explicit slice from `EXPLAIN` JSON, not double-counted into summaries.
- key raw fields and derived metrics

## Limits and honesty

- Missing timing reduces time-based hotspot fidelity; missing buffer counters reduce read-based hotspots. `summary.hasBuffers` is true when **any** parsed shared/local/temp buffer field is present on **any** node (null means absent; zero still counts as present).
- Query text is passed through and displayed; the tool does not claim exact SQL-to-plan mapping.

After **Analyze**, the compact **summary** line under the input includes node count, max depth, **severe findings count** (from the backend summary), whether actual timing and buffers were present, **`summary.plannerCosts`** (detected from JSON: `present` / `notDetected` / `mixed` / `unknown`), and any **warnings** when the engine reports limitations. When the request used **`planText`**, the API may include **`planInputNormalization`**; the UI shows a one-line note (**Parsed raw JSON directly** vs **Normalized pasted QUERY PLAN output**). Copy actions use **share-link** wording in non-auth mode and **artifact link** wording when the server reports auth enabled; invalid or missing **`analysis=`** links show a clear error (including **access denied** in auth mode). When auth is enabled, an optional **Sharing** panel can adjust scope and link access (owner-only). **Phase 38:** production deployments should use **`JwtBearer`** (owner = JWT **`sub`**) or **`ApiKey`** (mapped user id); legacy **`BearerSubject`** stores the entire bearer string as owner—see [Deployment & auth](deployment-auth.md).

### Plan source / EXPLAIN metadata (Phase 34)

Below the summary line, a short **Plan source / EXPLAIN metadata** block lists:

- whether **source query** text was provided
- **planner costs** detection (independent of declared EXPLAIN options)
- **declared options** from `explainMetadata.options` when the client sent them
- optional **recorded EXPLAIN command** text when provided

This is separate from findings: it documents *how the plan was captured*, not *what the plan did wrong*.

## Graphical tree view

Use the **Graph** toggle under “Plan tree” to view the execution plan as a readable, pan/zoom-able tree in the **left** column of the plan workspace (full width on small screens). Nodes are clickable and stay in sync with:

- hotspot clicks
- findings list clicks
- selected node detail panel

### Graph controls

- **Fit**: fit the whole plan into view
- **Focus**: center on the currently selected node
- **Reset**: reset viewport to default

### Graph search (highlight, not filter)

Use “Graph search” to highlight nodes by operator/relation/index text:

- matches are highlighted
- non-matches are dimmed
- use **prev/next** to jump between matches (updates selection + focus)
- a **match list** appears under the search box; click an entry to quick-jump
- if a match is hidden under a collapsed branch, the graph auto-expands the necessary ancestors

### Subtree collapse/expand

Click the `▾` control on a node to collapse its descendants. Collapsed nodes remain visible and marked; descendants are hidden until expanded.
