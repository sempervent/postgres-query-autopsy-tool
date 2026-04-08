# Reporting issues

Use this structure when you open a [GitHub issue](https://github.com/sempervent/postgres-query-autopsy-tool/issues). It keeps reports actionable for both **product/UX** bugs and **tooling/CI/docs** problems.

---

## 1. One-line summary

What went wrong, in plain language?

---

## 2. Type of issue (check any that apply)

- [ ] **Analyze** — paste/analyze workflow, plan graph, guide rail, findings, suggestions, selected node
- [ ] **Compare** — two-plan compare, mapping, pair detail, change briefing, continuity
- [ ] **Clipboard / copy / share links** — Copy reference, Copy link, share URL, suggested EXPLAIN copy, export copy
- [ ] **Exports / reports** — Markdown, HTML, JSON, API report endpoints
- [ ] **Auth / sharing** — artifact access, API keys, JWT, proxy mode
- [ ] **Docs** — wrong or missing documentation (link the page)
- [ ] **CI / tests / Docker** — workflow failure, `verify-frontend-docker`, Playwright, backend fixtures
- [ ] **Regression** — worked in a previous version or commit (say when if you know)
- [ ] **Other** — describe below

---

## 3. Expected vs actual

- **Expected:**
- **Actual:**

---

## 4. Reproduction

1. Steps (numbered, starting from a clean load or fresh tab if relevant):
2. **Inputs:** paste a **minimal** plan snippet, name a fixture under `tests/.../fixtures/postgres-json/`, or describe the SQL/EXPLAIN shape without pasting secrets.
3. **URL/query:** e.g. `?analysis=…`, `?comparison=…`, `?node=…` (redact tokens).

---

## 5. Environment

| | |
|--|--|
| **OS** | e.g. macOS 15, Ubuntu 24.04, Windows 11 |
| **Browser** | e.g. Safari 18, Chrome 131, Firefox 133 |
| **How you run the UI** | e.g. `docker compose`, Vite dev server `https://localhost:5173`, deployed URL |
| **Node** (if dev/build) | `node -v` — project expects **20.18.x** per `.nvmrc` / `package.json` **engines** |
| **.NET** (if API/backend) | e.g. **8.0.x** — note if you only used **`make test-backend-docker`** |
| **Git revision** | `git rev-parse --short HEAD` |

**Clipboard note:** Copy actions use a **synchronous** path first, then the Clipboard API. Issues on **non-HTTPS** (except `localhost`) or **locked-down** browsers are expected to be harder — say so here.

---

## 6. Verification you already ran (optional)

Examples: `npm test`, `./scripts/verify-frontend-docker.sh`, `make test-backend-docker`, `mkdocs build --strict`.

---

## 7. Logs / screenshots

- Browser **console** errors (redact secrets)
- **Network** failing request (path + status, no API keys)
- Screenshot if **visual** or **layout**
- For **CI**, link the **workflow run** and paste the **failing step** log excerpt
- For **copy / share-link** bugs, paste the **multi-line clipboard block** if you can (it usually starts with the URL and includes **`PQAT analysis:`** or **`PQAT compare:`** plus ids)—that matches what maintainers need to reproduce deep links and artifact scope.

---

## 8. Suggested severity (your view)

- **Blocker** — cannot use core workflow
- **Major** — workaround exists but painful
- **Minor** — polish, docs, edge case

Maintainers may relabel.

---

Thank you — concise, reproducible reports get fixed faster.
