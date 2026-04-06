# Visual regression (`e2e-visual`)

Canonical **full-page** screenshots guard the workstation after major UI passes. The suite stays **small** by design.

## Frames (4)

| PNG stub | What it captures |
|----------|------------------|
| **`analyze-happy`** | Fixture analyze → summary + graph with at least one **React Flow** node + first **Finding** row visible |
| **`compare-happy`** | Two fixtures compared → **Findings diff** + **Key metric deltas** |
| **`analyze-error-corrupt`** | Seeded **422** corrupt analysis (`POST /api/e2e/seed/corrupt-analysis`) |
| **`analyze-error-access-denied`** | **`GET /api/analyses/…` → 403** via **`page.route`** (no JWT stack; deterministic) |

Playwright writes **`*-e2e-visual-linux.png`** under **`canonical.spec.ts-snapshots/`** on Linux (same OS as **`mcr.microsoft.com/playwright:v1.52.0-jammy`** / GitHub Actions).

## Project

- **Playwright project:** `e2e-visual` (`playwright.config.mjs`).
- **Spec:** `canonical.spec.ts` (add sibling specs under `e2e/visual/` only when worth the baseline cost).

## Determinism & stability (Phase 57 + Phase 65)

- **`data-visual-regression="1"`** on `<html>` — flat **`#root`** background (`index.css`).
- **`prefers-reduced-motion: reduce`**, dark **`colorScheme`** ( **`page.emulateMedia`** ).
- **Phase 65–66 — theme lock:** `canonical.spec.ts` **`addInitScript`** sets **`localStorage['pqat_theme_v1']='dark'`**, **`data-theme="dark"`**, **`data-effective-theme="dark"`**, **`data-theme-preference="dark"`**, and **`documentElement.style.colorScheme='dark'`** so baselines stay independent of the runner’s OS light/dark mode. New visual specs should either reuse this pattern or document an explicit theme choice. Non-pixel theme checks live in **`e2e/theme-appearance.spec.ts`** (**`e2e-smoke`**).
- **`document.fonts.ready`** before each screenshot (bundled **@fontsource**).
- **Analyze happy:** waits for **`.react-flow__node`** + first **`Finding:`** control before capture.
- **Compare happy:** waits for **Key metric deltas** after **Comparing…** clears.
- **`maxDiffPixelRatio`** (see config) tolerates minor renderer drift.

## Run (Docker — matches CI)

From repo root (**`.env.testing`** with **`PQAT_E2E_ENABLED=true`** for corrupt seed):

```bash
./scripts/e2e-playwright-docker.sh --visual
# or: make e2e-playwright-docker-visual
```

## Update baselines

Regenerate PNGs on **Linux** after intentional UI changes:

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

Workflow **`.github/workflows/ci.yml`** job **`e2e-playwright-visual`** runs **`--project=e2e-visual`** against **`.env.testing`** (tracked in repo).

## Host Playwright

Non-Linux hosts may produce pixel drift vs CI; prefer Docker above for baseline updates.
