#!/usr/bin/env bash
# CI-like frontend verify: npm ci, fixtures:check (same as ci.yml frontend job), test, build.
# Phase 91: GitHub Actions frontend job runs this script verbatim — canonical path for Rolldown/Vitest on linux-x64.
# Mounts the full repository at /repo so check-e2e-fixtures.mjs can read tests/backend.unit/.../postgres-json.
#
# Override image: PQAT_NODE_IMAGE=… ./scripts/verify-frontend-docker.sh
# Phase 79–81: Node image digest pinned; CI uses Node 20.18.0 on ubuntu; Alpine image tracks the Node 20 line (see contributing).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_NODE_IMAGE='node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c'
IMAGE="${PQAT_NODE_IMAGE:-$DEFAULT_NODE_IMAGE}"

exec docker run --rm \
  -v "$ROOT:/repo" \
  -w /repo/src/frontend/web \
  "$IMAGE" \
  sh -c 'npm ci && npm run fixtures:check && npm test && npm run build'
