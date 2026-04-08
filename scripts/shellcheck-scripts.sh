#!/usr/bin/env bash
# Phase 81 — optional static analysis for repo shell scripts (run locally / in CI if shellcheck is installed).
# Usage: ./scripts/shellcheck-scripts.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if ! command -v shellcheck >/dev/null 2>&1; then
  echo "shellcheck-scripts: install shellcheck (https://github.com/koalaman/shellcheck) or skip this check." >&2
  exit 1
fi
cd "$ROOT"
exec shellcheck -x scripts/lint-workflows.sh scripts/verify-frontend-docker.sh scripts/e2e-playwright-docker.sh scripts/sync-e2e-fixtures.sh
