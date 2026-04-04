# Analyze Workflow

## Input

1. Paste plan output: **plain EXPLAIN JSON** or typical **`psql` QUERY PLAN** cell text (header, separators, `(N rows)`, `+` wraps—see [Capturing EXPLAIN JSON](capturing-explain-json.md)). Prefer `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` when you need forensic evidence; planner **`COSTS`** are optional.
2. Optionally paste the source SQL query text (stored on the server with the analysis when provided).
3. Optionally expand **Suggested EXPLAIN command** to generate copy-paste SQL (toggles for `ANALYZE`, `VERBOSE`, `BUFFERS`, and explicit `COSTS true`/`false`) and, if **Send EXPLAIN options with analyze request** is checked, attach declared options plus an optional “recorded command” to the API payload (`explainMetadata`).
4. Click **Analyze**.

**Local vs reopened analysis:** Pasting and analyzing keeps the raw text in the browser until you clear it. After success, the address bar gains **`?analysis=<opaqueId>`** (and **`node=`** when a node is selected) so the same result can be fetched again from **SQLite-backed** storage. Opening a URL with **`analysis=`** loads the snapshot from the server (`GET /api/analyses/{id}`) and clears the textarea; running **Analyze** again on new paste strips the old `analysis` query param and replaces it after the new response. **Copy share link** (non-auth) or **Copy artifact link** (auth deployments) reflects server policy—see [Deployment & auth](deployment-auth.md). Links remain valid across API restarts if the database file is kept (see [API & Reports](api-and-reports.md#storage-phase-36-access-control-phase-37)).

See [Capturing EXPLAIN JSON](capturing-explain-json.md) for recommended commands, share-link behavior, and normalizer caveats.

## Analyze workspace (Phase 39)

After **Analyze** succeeds, the page is organized as an **investigation workstation** instead of one long vertical stack:

1. **Input / actions** — paste, suggested EXPLAIN, **Analyze**, exports, optional **Sharing** when auth is enabled.
2. **Summary + metadata** — compact summary line, **Plan source / EXPLAIN metadata**, and share/artifact copy when applicable.
3. **Plan workspace** — the graph (or text tree) is the visual center. On viewports **about 1080px and wider**, this region is a **two-column layout**: the **left** column holds plan mode toggles, search boxes, fit/focus/reset, and the tree or graph; the **right** column is the **Plan guide** rail with:
   - **Selection snapshot** when a node is selected: human-readable label, join/branch subtitle when applicable, up to three key metric lines, and a short cue when a severe finding anchors that node
   - **What happened** — narrative text with line clamping so it stays scannable
   - **Where to inspect next** — the same **hotspot** rows as elsewhere (click/keyboard selects the node; **Copy** stays a separate control)
   - **Top findings** — a compact preview (not a replacement for the full list below)
   - **Next steps** — a short preview of **optimization suggestions** with **Focus …** (and **Why + cautions** where shown) so “what to try next” sits next to the plan
   - **Source query** — optional, folded in a `<details>` block in the rail when query text exists

   On **narrow** viewports the rail **stacks under** the graph so the flow remains a single column.

4. **Findings, suggestions, and selected node** — below the plan workspace, a second band keeps the **full findings** list on one side and the **full optimization suggestions** plus **selected node** detail on the other. The **Selected node** panel keeps all prior technical content; heavier sections (**operator context signals**, parallel **Workers** summary/grid, raw plan JSON, derived metrics) use **`<details>`** progressive disclosure so the default view is calmer while power users can still expand everything.

The graph panel uses a **viewport-relative height** (clamped min/max) so small plans do not leave a huge empty band under the canvas; large plans still get enough room. Graph behavior (search highlight, collapse, fit, focus, URL **`?node=`** sync, copy reference/link) is unchanged in intent.

## Customize workspace (Phase 40)

The Analyze UI is split into **typed panels** (capture, summary, plan workspace, plan guide, findings, optimization suggestions, selected node). Use **Customize workspace** (under **Plan workspace**) to:

- **Presets:** **Balanced** (default), **Focus** (hides optimization suggestions region, reorders lower columns), **Detail** (suggestions before findings in the lower band).
- **Visibility:** show or hide each major panel. If **plan capture** is hidden, a **Show input** strip appears so you can recover it.
- **Plan guide section order:** move blocks (selection snapshot, what happened, hotspots, top findings, next steps, source query) **up/down**.
- **Lower band column order:** reorder **findings**, **optimization suggestions**, and **selected node** columns on desktop (narrow viewports stack in that order).

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

### Optimization suggestions (Phase 32)

**Findings** explain *what looks wrong* and attach evidence. **`optimizationSuggestions`** are a separate, ranked list of *investigation-oriented next steps*: index experiments, query-shape or ordering ideas, statistics maintenance, join/hash/sort volume reductions, parallelism skew checks, Timescale/chunk workload guidance, and explicit “observe before change” validation.

- Suggestions are **evidence-linked** (`relatedFindingIds`, `relatedIndexInsightNodeIds`, `targetNodeIds`) and include **`suggestionId`** values with the **`sg_`** prefix (deterministic content hash). Compare-only payloads may also include **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`** on suggestions. Fields include **confidence**, **priority**, **cautions**, and **validation steps**.
- They are **not prescriptions**: the tool does not emit guaranteed `CREATE INDEX` DDL. Language stays conservative (especially for **P** chunked-bitmap plans, where naive “add another index” advice is suppressed in favor of window pruning, ordering, aggregates, and retention-style investigation).
- The **Plan guide** rail shows a **preview** of top suggestions (category, summary, **Validate by**, **Focus …** on a primary target, **Why + cautions**). The **full** ranked list lives in the lower **Optimization suggestions** section with the same interactions.
- The **Selected node** panel may show the **strongest related suggestion** when any suggestion lists that `nodeId` in `targetNodeIds`.

### Plan index posture (summary card)

After analyze, the summary card can show an **Index posture** line from `indexOverview`: scan mix (seq vs index vs bitmap counts) or, for Append + many bitmap heaps, an explicit note that **per-chunk index use may already be happening** while total reads/temp work can still dominate.

### Selected node

The **selection snapshot** in the Plan guide rail gives an immediate, compact readout when you click the graph, hotspots, findings, or suggestions. The **full** selected node panel (lower section) shows:

- human-readable label
- join/branch subtitle when applicable
- optional side-aware context line when supported by evidence
- **Copy reference** (human-readable node text) and **Copy link** (full URL with `?node=<nodeId>` for the current selection). **Phase 34:** the address bar stays in sync: selecting a node updates `?node=` (replace history, deduped), loading a URL with a valid `node=` restores selection after analyze, and browser back/forward updates the selected node when the id still exists in the current result.
- **Related optimization suggestion** (when a ranked `optimizationSuggestions` entry targets this `nodeId`): title + summary only, to avoid duplicating the full suggestions list
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
