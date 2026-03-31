# Compare Workflow

## What compare does (and does not)

- **Does**: heuristically maps nodes between Plan A and Plan B, computes deltas, summarizes context diffs, and highlights findings changes.
- **Does not**: prove mathematical identity of nodes. Low-confidence matches are leads, not guarantees.

## Confidence

Mapping confidence is emitted per pair. Treat low-confidence pairs as “suspects” until validated by nearby structure and evidence.

## Reading the compare UI

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

## Guardrails

Side attribution is intentionally conservative. If evidence is ambiguous, the UI falls back to non-side-specific badges.

