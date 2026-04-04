#!/usr/bin/env bash
# Phase 51: copy plan JSON from backend unit fixtures into web/e2e/fixtures (Playwright bundle).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/postgres-json"
DST="$ROOT/src/frontend/web/e2e/fixtures"
mkdir -p "$DST"
FILES=(simple_seq_scan.json compare_before_seq_scan.json compare_after_index_scan.json)
for f in "${FILES[@]}"; do
  cp "$SRC/$f" "$DST/$f"
  echo "synced $f"
done
echo "Done: $DST"
