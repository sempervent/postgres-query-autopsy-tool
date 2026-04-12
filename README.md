# Postgres Query Autopsy Tool

[![CI](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/ci.yml)
[![Workflow lint](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/workflow-lint.yml/badge.svg)](https://github.com/sempervent/postgres-query-autopsy-tool/actions/workflows/workflow-lint.yml)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-222?logo=githubpages&logoColor=white)](https://sempervent.github.io/postgres-query-autopsy-tool/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![Node 20.18](https://img.shields.io/badge/node-20.18-339933?logo=nodedotjs)](https://nodejs.org/)

Forensic analysis for **PostgreSQL** execution plans: paste **`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)`**, get a normalized plan tree, evidence-backed **findings**, and a workstation-style **Analyze** / **Compare** UI (graph, guide rail, shareable persisted artifacts, optional auth). Built as a **.NET 8** API + **React** SPA, with **Playwright** smoke and **region-targeted** visual regression in CI.

---

### Documentation

| | |
|--|--|
| **Hosted manual** | **[GitHub Pages →](https://sempervent.github.io/postgres-query-autopsy-tool/)** |
| **Contributor guide** | [`docs/contributing.md`](docs/contributing.md) — [verification tiers](docs/contributing.md#verification-tiers-phase-80), [CI parity commands](docs/contributing.md#ci-parity-verified-commands), [digest / pin playbook](docs/contributing.md#container-image-pins--re-pinning-phase-7981) |
| **Issues** | **[`ISSUE.md`](ISSUE.md)** checklist + GitHub templates: **Bug report**, **Feature / enhancement** (`.github/ISSUE_TEMPLATE/`) |
| **Local docs** | `python -m venv .venv-docs && . .venv-docs/bin/activate && pip install -r requirements-docs.txt && mkdocs serve` (or reuse **`docs/.venv`** if present) |

The documentation site home page repeats the **badge row** above so the same trust signals appear on **MkDocs** (see [`docs/index.md`](docs/index.md)).

---

### Verification (trust paths)

Commands run from the **repository root** unless noted.

| You want | Command |
|-----------|---------|
| **Fastest** (host Node **20.18.x**) | `make repo-health` — workflow lint + `npm test` in `src/frontend/web` |
| **Fast + Docker frontend** (no host Node / Rolldown issues) | `make repo-health-docker` — lint + **`verify-frontend-docker`** (`npm ci`, **`fixtures:check`**, test, build; **full repo mounted** for fixture parity) |
| **Full, host toolchains** | `make verify` — lint + `dotnet test` + host frontend tests |
| **Full, Docker backend + frontend** | `make verify-docker` — matches “no host .NET / no host Node” CI-like flow |
| **Lint only** | `make lint-workflows` — actionlint via PATH, digest-pinned Docker, or `ACTIONLINT_BOOTSTRAP=1` (checksum-verified download) |

Details: **`make help`** and **[Contributing](docs/contributing.md)**.

**Frontend CI (Phase 91):** GitHub Actions **`frontend`** runs **`./scripts/verify-frontend-docker.sh`** (digest-pinned **Node 20** Alpine) — **`npm ci`**, **`fixtures:check`**, **`npm test`**, **`npm run build`** — the same path as **`make verify-frontend-docker`**, avoiding host-runner **npm optional-dependency** / **Rolldown** native-binding flakes. For local work, **`optionalDependencies`** **`@rolldown/binding-*`** still helps **host** **`npm ci`**; use **Node 20.18.x** per **`engines`** / **`.nvmrc`**, or the Docker script when Vitest fails to start.

---

### Run the app (Docker Compose)

```bash
docker compose up --build
```

- UI: http://localhost:3000  
- API health: http://localhost:8080/api/health  

---

### What you get (MVP)

- Parse plan JSON → structured tree and metrics  
- Ranked **findings** with bounded evidence  
- **Compare** two plans (mapping, deltas, continuity cues); saved **`?comparison=`** / **`?analysis=`** links show a compact **— reopened** thread in the pair or ranked strip, and snapshot exports can echo the same restored context in the success line  
- Export **JSON / Markdown / HTML** reports  
- In-app **How to use Analyze / Compare** guides (distinct **guide** styling—dotted border and teal accent—so help is not mistaken for findings or plan narrative); **`?`** / **Shift+/** reopen help when focus is not in an input; **`Esc`** closes the guide when focus is not in a text field and returns focus to the toggle; **`?guide=1`** opens in guided mode (URL-driven open syncs in **`useLayoutEffect`** so the first paint matches the open guide); guide footer **Copy merged guided link** (**this URL +** **`guide=1`**, for reproducing context) vs **Copy entry guided link** (**path +** **`?guide=1`** only, for clean onboarding); polite **`aria-live`** announcements on explicit open/close and when **`?guide=`** opens the panel after dismiss; optional **Tab loop** inside the guide after explicit opens; repeat users can hide the guide and that choice persists (**`localStorage`**, per workflow)  
- **Sample plan / sample pair** chips on **Analyze** and **Compare** (capture + guide): curated examples (four **Analyze** shapes + two **Compare** stories) load bundled JSON in one click; **Analyze** uses a compact **triage deck** (**Start here**, ranked **Then scan**, sticky band on narrow layouts sized to the real top bar) with **Findings** / **Next steps** / **selected node** / **Plan guide** sharing evidence-thread cues; **Compare** mirrors triage + **Show in list** into the navigator, a **Context** bridge on the selected pair (including change-story beats), briefing-aligned row hints, and dense readouts behind **`<details>`** by default  
- **Analyze** results are **readability-first**: a smaller default plan graph, more room for triage/summary/findings; **graph selection** surfaces **related evidence in the Plan workspace** first (with a light **Evidence** bridge in the selected-node column when both panels are on — no duplicate preview stacks)  

---

### Repository layout

| Path | Role |
|------|------|
| `src/backend/` | .NET 8 API + analysis core |
| `src/frontend/web/` | React + TypeScript UI |
| `tests/backend.unit/` | xUnit + `postgres-json` fixtures |
| `docs/` | MkDocs source (published to Pages) |
| `scripts/` | Lint, E2E wrappers, fixture sync, frontend Docker verify |

**Source:** [github.com/sempervent/postgres-query-autopsy-tool](https://github.com/sempervent/postgres-query-autopsy-tool)
