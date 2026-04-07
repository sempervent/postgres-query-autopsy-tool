#!/usr/bin/env bash
# Phase 79 — CI-like frontend verify: npm ci + test + build inside Node 20 Alpine (same family as web Dockerfile).
# Override image: PQAT_NODE_IMAGE=node:20-alpine npm run … / env PQAT_NODE_IMAGE=… ./scripts/verify-frontend-docker.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Multi-arch index digest — bump with Dockerfile when Node pin changes (`docker buildx imagetools inspect node:20-alpine`).
DEFAULT_NODE_IMAGE='node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c'
IMAGE="${PQAT_NODE_IMAGE:-$DEFAULT_NODE_IMAGE}"

exec docker run --rm \
  -v "$ROOT/src/frontend/web:/app" \
  -w /app \
  "$IMAGE" \
  sh -c 'npm ci && npm test && npm run build'
