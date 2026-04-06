# Postgres Query Autopsy Tool

A forensic workstation for PostgreSQL execution plans. The **Phase 55–57** UI pass tightens the dark “operator deck” look—clearer state banners (errors, access, loading), a stronger summary column, guided suggestion blocks, calmer motion (**reduced motion** respected), **bundled fonts** (no Google CDN at runtime), shared **Analyze/Compare** error and **utility** chrome (customizer, sharing, capture disclosures), and a **Playwright visual** suite (**four** canonical frames, including access denied) wired through **CI**. **Phase 65–66** make **appearance** first-class: **System** (default, follows OS), **Dark**, and **Light**, with **localStorage** (`pqat_theme_v1`), optional **account sync** of the same string under **`appearance_theme_v1`** when auth + credentials exist, **`html[data-theme]`** / **`data-effective-theme`** + CSS variables (including **Phase 66** semantic tints for badges, story lanes, graph chrome), and Playwright **theme smoke** on the **`e2e-smoke`** project. Visual regression still **locks dark** for deterministic pixels.

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

- **Analyze**: **graph-centered workspace** with **Plan guide** rail, lower-band findings/suggestions/node detail, optional **Customize workspace layout** (hide/show panels, **drag-or-Up/Down** reorder for guide sections and lower columns, presets including **Wide graph** / **Reviewer** / **Compact**), **three responsive tiers** (900px / 1320px), **localStorage** layout persistence, and **account-scoped** layout sync when auth + **`VITE_AUTH_*`** credentials are configured. The main shell uses a **fluid max-width**; **Phase 43** adds a shared **dark-first visual system** (layered panels, chips for severity/confidence, metric tiles, pill nav). **Phase 65** extends that system to **light** and **system** modes without losing hierarchy on story/readout surfaces. **Phase 44** adds **`workstation-patterns.css`** for dense forms and list chrome, **lazy-loaded** **`AnalyzePage`**, and **on-open** loading of the customizer’s DnD lists so the initial bundle stays smaller. **Phase 45** **progressively hydrates** the workstation: React Flow loads only in **Graph** mode (skeleton + prefetch), lower-band panels are **lazy** with **`LowerBandPanelSkeleton`**, long findings/suggestions lists are **virtualized**, and dense selected-node sections load in a **second lazy chunk** after the header.
- **Compare**: the same **tiered responsive** and **customizable** workspace model (summary + main grids tuned per breakpoint, **drag-or-Up/Down** section reorder, **Wide pair** preset, local + optional account layout sync), plus improved/worsened pairs, a synchronized twin **branch context** strip, context diffs, and side-aware join hints when evidence supports it. **Phase 44** aligns optional SQL/EXPLAIN blocks and navigator/summary surfaces with shared **`pqat-*`** patterns and **lazy-loads** **`ComparePage`**. **Phase 45** applies the same **virtual list** pattern to large **findings diff** columns when the diff count crosses a threshold.
