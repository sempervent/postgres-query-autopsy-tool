#!/usr/bin/env bash
# Phase 74–76: Validate .github/workflows/*.yml with actionlint (catches YAML foot-guns + common GHA mistakes).
# Usage: ./scripts/lint-workflows.sh
# Prefers: actionlint on PATH; else Docker image pinned to match `.github/workflows/workflow-lint.yml` (v1.7.7).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ACTIONLINT_DOCKER_IMAGE="${ACTIONLINT_DOCKER_IMAGE:-rhysd/actionlint:1.7.7}"

if command -v actionlint >/dev/null 2>&1; then
  cd "$ROOT"
  exec actionlint -color
fi

if docker info >/dev/null 2>&1; then
  exec docker run --rm \
    -v "$ROOT:/repo" \
    -w /repo \
    "$ACTIONLINT_DOCKER_IMAGE" \
    -color
fi

echo "lint-workflows: install actionlint (https://github.com/rhysd/actionlint) or use Docker." >&2
exit 1
