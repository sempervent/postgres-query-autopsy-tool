# Visual regression (`e2e-visual`)

**Phase 75:** Happy-path captures are **region-targeted** (stable story surfaces), not full-page document shots — the Analyze workstation grew taller; full-page baselines were brittle against layout expansion.

Error-path captures use the **`analyze-page-error`** panel only (compact, deterministic).

The suite stays **small** by design: **four tests**, **eight PNG baselines** (Linux).

## Tests & snapshot files

| Test | PNG stubs (Linux suffix `-e2e-visual-linux.png`) |
|------|--------------------------------------------------|
| **Analyze happy path** | **`analyze-happy-summary`** (`aria-label="Analysis summary"`), **`analyze-happy-workspace`** (graph + guide), **`analyze-happy-findings`** (`Findings list` panel) |
| **Compare happy path** | **`compare-happy-summary`**, **`compare-happy-navigator`**, **`compare-happy-pair`** (`aria-label` targets on summary shell, navigator panel, pair inspector column) |
| **Analyze corrupt** | **`analyze-error-corrupt`** — error banner only |
| **Analyze access denied** | **`analyze-error-access-denied`** — error banner only |

## Project

- **Playwright project:** `e2e-visual` (`playwright.config.mjs`).
- **Spec:** `canonical.spec.ts` (helpers in `visualTestHelpers.ts`).
- **Compare regions:** `Compare summary`, `Compare navigator`, `Compare pair inspector` — `aria-label`s on `CompareSummaryColumn`, `CompareNavigatorPanel`, `ComparePairColumn` (Phase 75).

## Determinism & stability (Phase 57 + 65 + 75)

- **`data-visual-regression="1"`** on `<html>` — flat **`#root`** background (`index.css`).
- **`prefers-reduced-motion: reduce`**, dark **`colorScheme`** ( **`page.emulateMedia`** ).
- **Theme lock:** `canonical.spec.ts` **`addInitScript`** sets **`localStorage['pqat_theme_v1']='dark'`**, **`data-theme="dark"`**, **`data-effective-theme="dark"`**, **`data-theme-preference="dark"`**, and **`documentElement.style.colorScheme='dark'`**. Non-pixel theme checks live in **`e2e/theme-appearance.spec.ts`** (**`e2e-smoke`**).
- **`document.fonts.ready`** before each screenshot (bundled **@fontsource**).
- **Analyze happy:** waits for **`.react-flow__node`**, first **`Finding:`** control, and **`Findings list`** before captures; each region **`scrollIntoViewIfNeeded`**.
- **Compare happy:** waits for **Findings diff**, **Key metric deltas**, and the three labeled regions.
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

Workflow **`.github/workflows/ci.yml`** job **`e2e-playwright-visual`** runs **`--project=e2e-visual`** against **`.env.testing`**.

## Host Playwright

Non-Linux hosts may produce pixel drift vs CI; prefer Docker above for baseline updates.
