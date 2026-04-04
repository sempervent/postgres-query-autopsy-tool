# Postgres Query Autopsy Tool

A forensic workstation for PostgreSQL execution plans.

Given `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` output, the tool:

- Parses and normalizes the plan tree
- Computes derived metrics (exclusive vs subtree time, buffer shares, row-estimate divergence, etc.)
- Emits ranked findings with evidence and guardrails
- Compares two plans heuristically (mapping + deltas + context diffs)
- Presents an interactive UI designed for “what do I inspect next?”

## What it is for

- Investigating why a query is slow, buffer-heavy, memory-heavy, or structurally problematic
- Explaining *which branch/operator* is hot and *what the plan evidence says* (without internal ids like `root.0`)
- Comparing “before vs after” plans and understanding what changed and why it matters

## High-level flow

```mermaid
flowchart TD
  A[Plan JSON] --> B[Parser]
  B --> C[Normalized plan model]
  C --> D[Derived metrics]
  D --> E[Findings + ranking]
  D --> F[Operator context evidence]
  F --> G[Context diffs (compare)]
  E --> H[Analyze UI]
  G --> I[Compare UI]
```

## Quick links

- [Getting Started](getting-started.md)
- [Capturing EXPLAIN JSON](capturing-explain-json.md)
- [Architecture](architecture.md)
- [Analyze Workflow](analyze-workflow.md)
- [Compare Workflow](compare-workflow.md)
- [Findings Catalog](findings-catalog.md)
- [Fixtures & Sample SQL](fixtures.md)
- [Deployment & auth](deployment-auth.md)

## What you’ll see

- **Analyze**: **graph-centered workspace** with **Plan guide** rail, lower-band findings/suggestions/node detail, optional **Customize workspace** (hide/show panels, reorder guide sections and columns, presets), **localStorage** layout persistence, and **account-scoped** layout sync when auth + **`VITE_AUTH_*`** credentials are configured.
- **Compare**: improved/worsened pairs, a synchronized twin **branch context** strip (path + children in Plan A and B), context diffs, and side-aware join hints when evidence supports it.
