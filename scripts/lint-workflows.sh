#!/usr/bin/env bash
# Phase 74: Validate .github/workflows/*.yml with actionlint (catches YAML foot-guns + common GHA mistakes).
# Usage: ./scripts/lint-workflows.sh
# Prefers: actionlint on PATH; else Docker image rhysd/actionlint (same family as rhysd/actionlint@v1 in CI).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v actionlint >/dev/null 2>&1; then
  cd "$ROOT"
  exec actionlint -color
fi

if docker info >/dev/null 2>&1; then
  exec docker run --rm \
    -v "$ROOT:/repo" \
    -w /repo \
    rhysd/actionlint:latest \
    -color
fi

echo "lint-workflows: install actionlint (https://github.com/rhysd/actionlint) or use Docker." >&2
exit 1
