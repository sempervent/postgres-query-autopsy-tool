# Visual regression (`e2e-visual`)

**Phase 75:** Happy-path captures are **region-targeted** (stable story surfaces), not full-page document shots — the Analyze workstation grew taller; full-page baselines were brittle against layout expansion.

**Phase 76:** **Tooling pins**, **`waitForGraphLayoutSettled`** before the Analyze **workspace** screenshot, and a **viewport / tooling matrix** (below) so contributors know what CI assumes.

Error-path captures use the **`analyze-page-error`** panel only (compact, deterministic).

The suite stays **small** by design: **four tests**, **eight PNG baselines** (Linux).

## Viewport & capture matrix (`canonical.spec.ts`)

| Test | Viewport | Captures |
|------|-----------|----------|
| Analyze happy | **1280 × 900** | Three **region** PNGs: **Analysis summary**, **Analyze workspace** (graph + guide), **Findings list** |
| Compare happy | **1280 × 900** | Three **region** PNGs: **Compare summary**, **Compare navigator**, **Compare pair inspector** |
| Analyze corrupt | **1280 × 720** | **`analyze-page-error`** element only |
| Analyze access denied | **1280 × 720** | **`analyze-page-error`** element only |

**Theme / motion:** `addInitScript` locks **dark** theme + **`data-visual-regression="1"`**; **`page.emulateMedia`** sets **reduced motion** and **dark** `colorScheme`. See spec file for the exact attributes.

**Graph settle (Analyze workspace):** **`waitForGraphLayoutSettled`** waits for **`.react-flow__viewport`** to report usable size, then **two `requestAnimationFrame`** ticks before screenshots (reduces slow-CI flake).

## Tests & snapshot files

| Test | PNG stubs (Linux suffix `-e2e-visual-linux.png`) |
|------|--------------------------------------------------|
| **Analyze happy path** | **`analyze-happy-summary`**, **`analyze-happy-workspace`**, **`analyze-happy-findings`** |
| **Compare happy path** | **`compare-happy-summary`**, **`compare-happy-navigator`**, **`compare-happy-pair`** |
| **Analyze corrupt** | **`analyze-error-corrupt`** |
| **Analyze access denied** | **`analyze-error-access-denied`** |

## Tooling pins (Phase 76)

Keep these aligned when bumping Playwright:

| Piece | Pinned value |
|-------|----------------|
| **`package.json`** | **`@playwright/test`: `1.52.0`** (exact) |
| **`docker-compose.yml`** **`playwright`** image | **`mcr.microsoft.com/playwright:v1.52.0-jammy`** |
| **actionlint** (CI + **`scripts/lint-workflows.sh`**) | **`v1.7.7`** / **`rhysd/actionlint:1.7.7`** |

**Baseline weight:** eight PNGs total; prefer **updating existing regions** over adding new files unless a surface lacks contract coverage (Phase 75–76 kept the suite lean — no extra region added in Phase 76).

## Project

- **Playwright project:** `e2e-visual` (`playwright.config.mjs`).
- **Spec:** `canonical.spec.ts` (helpers in `visualTestHelpers.ts`).
- **Compare regions:** `Compare summary`, `Compare navigator`, `Compare pair inspector` — `aria-label`s on `CompareSummaryColumn`, `CompareNavigatorPanel`, `ComparePairColumn` (Phase 75).

## Determinism & stability (Phase 57 + 65 + 75 + 76)

- **`data-visual-regression="1"`** on `<html>` — flat **`#root`** background (`index.css`).
- **`prefers-reduced-motion: reduce`**, dark **`colorScheme`** ( **`page.emulateMedia`** ).
- **Theme lock:** `canonical.spec.ts` **`addInitScript`** sets **`localStorage['pqat_theme_v1']='dark'`**, **`data-theme="dark"`**, **`data-effective-theme="dark"`**, **`data-theme-preference="dark"`**, and **`documentElement.style.colorScheme='dark'`**. Non-pixel theme checks live in **`e2e/theme-appearance.spec.ts`** (**`e2e-smoke`**).
- **`document.fonts.ready`** before each screenshot (bundled **@fontsource**).
- **`maxDiffPixelRatio`** (see `playwright.config.mjs`) tolerates minor renderer drift.

## Run (Docker — matches CI)

From repo root (**`.env.testing`** with **`PQAT_E2E_ENABLED=true`** for corrupt seed):

```bash
./scripts/e2e-playwright-docker.sh --visual
# or: make e2e-playwright-docker-visual
```

## Update baselines

Regenerate PNGs on **Linux** after intentional UI changes to the **captured regions**:

```bash
docker compose --env-file .env.testing up -d --build api web
# wait for http://127.0.0.1:3000/api/health
docker compose --env-file .env.testing --profile testing run --rm \
  -e PLAYWRIGHT_CLI_ARGS="--project=e2e-visual --update-snapshots" \
  playwright
```

From `src/frontend/web` with stack on **:3000**:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:visual:update
```

Commit updates under **`canonical.spec.ts-snapshots/`**.

## CI

- **`.github/workflows/ci.yml`** — **`e2e-playwright-visual`** runs **`--project=e2e-visual`** against **`.env.testing`**.
- **`.github/workflows/workflow-lint.yml`** — **actionlint** when workflow files or **`.actionlint.yaml`** change.

## Host Playwright

Non-Linux hosts may produce pixel drift vs CI; prefer Docker above for baseline updates.
