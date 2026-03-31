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
- **shared reads**: I/O hotspots (requires `BUFFERS`)

### Findings

Findings are ranked by severity/confidence and tied to nodes. Use the node anchor label to jump into the plan tree.

### Selected node

The selected node panel shows:

- human-readable label
- join/branch subtitle when applicable
- optional side-aware context line when supported by evidence
- a **Copy reference** action for sharing a concise node reference
- key raw fields and derived metrics

## Limits and honesty

- Missing timing/buffers reduces hotspot fidelity.
- Query text is passed through and displayed; the tool does not claim exact SQL-to-plan mapping.

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
