# Compare Workflow

## What compare does (and does not)

- **Does**: heuristically maps nodes between Plan A and Plan B, computes deltas, summarizes context diffs, and highlights findings changes.
- **Does not**: prove mathematical identity of nodes. Low-confidence matches are leads, not guarantees.

## Confidence

Mapping confidence is emitted per pair. Treat low-confidence pairs as “suspects” until validated by nearby structure and evidence.

## Reading the compare UI

### At the top: summary + “what changed most”

After a compare run, start at the top:

- **Summary cards**: total runtime, shared reads, severe findings, node count, max depth (Plan B value + delta vs Plan A).
- **What changed most**: quick-jump to the top worsened and top improved mapped pairs.

### Improved / worsened lists

Each row uses human-readable pair labels and may include badges:

- generic context badges (hash pressure, scan waste, sort spill, memoize, nested loop)
- **side-aware join badges** when the evidence is explicitly side-scoped (build side / inner side)

### Selected pair panel

The selected pair shows:

- readable pair heading + join branch subtitle (when applicable)
- a **Copy reference** action for sharing a human-readable pair reference
- **Join side change summary** when supported (hash build / inner waste)
- context change summary highlights
- raw operator fields and evidence side-by-side

### Findings diff

Diff finding rows include a subtle **Copy** action that copies a concise human-readable reference for the anchored node (optionally annotated with the change type / rule id).

Notes:
- Compare is **heuristic**: mapping confidence is shown because some rewrites change structure and labels. Treat low-confidence pairs as leads to validate, not guarantees.

## Guardrails

Side attribution is intentionally conservative. If evidence is ambiguous, the UI falls back to non-side-specific badges.

