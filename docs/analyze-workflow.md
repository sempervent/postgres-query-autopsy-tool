# Analyze Workflow

## Input

1. Paste the plan JSON output (prefer `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)`).
2. Optionally paste the source SQL query text (best-effort orientation aid; not required).
3. Click **Analyze**.

See [Capturing EXPLAIN JSON](capturing-explain-json.md) for recommended commands and caveats.

## Reading the results

### Hotspots (“Where to inspect next”)

Hotspots are rendered as clickable items that select the corresponding node.

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
- The Analyze sidebar shows the **top suggestions** with category pills, summary, a **Validate by** line, optional **Show node** when a primary target exists, and an expandable **Why + cautions** block.
- The **Selected node** panel may show the **strongest related suggestion** when any suggestion lists that `nodeId` in `targetNodeIds`.

### Plan index posture (summary card)

After analyze, the summary card can show an **Index posture** line from `indexOverview`: scan mix (seq vs index vs bitmap counts) or, for Append + many bitmap heaps, an explicit note that **per-chunk index use may already be happening** while total reads/temp work can still dominate.

### Selected node

The selected node panel shows:

- human-readable label
- join/branch subtitle when applicable
- optional side-aware context line when supported by evidence
- **Copy reference** (human-readable node text) and **Copy link** (full URL with `?node=<nodeId>` for the current selection). After a new analyze run, a URL with `node=` is applied **once** when that id exists in the result (the app does not continuously fight the address bar on every click).
- **Related optimization suggestion** (when a ranked `optimizationSuggestions` entry targets this `nodeId`): title + summary only, to avoid duplicating the full suggestions list
- **Access path / index insight** (when `indexInsights` entries target this `nodeId`): compact headline, access-path family, and signal kinds (investigation-oriented, not prescriptions)
- **Buffer I/O**: when this node has any shared/local/temp buffer counters in the API payload (including explicit zeros), a short labeled list is shown above the raw JSON dump; if the plan has buffers elsewhere but this operator has none, a one-line hint explains that
- **Workers** (parallel plans): when the node has a non-empty `workers` array, a one-line **worker summary** (count and conservative read/time/temp cues when applicable) plus a compact per-worker grid (worker id, total time, rows, shared hit/read, temp read/write). Parent row buffer/timing fields remain the leader aggregate when PostgreSQL reports them; worker rows are the explicit slice from `EXPLAIN` JSON, not double-counted into summaries.
- key raw fields and derived metrics

## Limits and honesty

- Missing timing reduces time-based hotspot fidelity; missing buffer counters reduce read-based hotspots. `summary.hasBuffers` is true when **any** parsed shared/local/temp buffer field is present on **any** node (null means absent; zero still counts as present).
- Query text is passed through and displayed; the tool does not claim exact SQL-to-plan mapping.

After **Analyze**, the compact **summary** line under the input includes node count, max depth, **severe findings count** (from the backend summary), whether actual timing and buffers were present, and any **warnings** when the engine reports limitations.

## Graphical tree view

Use the **Graph** toggle under “Plan tree” to view the execution plan as a readable, pan/zoom-able tree. Nodes are clickable and stay in sync with:

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
