#!/usr/bin/env bash
# Phase 51: copy plan JSON from backend unit fixtures into web/e2e/fixtures (Playwright bundle).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/postgres-json"
DST="$ROOT/src/frontend/web/e2e/fixtures"
mkdir -p "$DST"
FILES=(
  simple_seq_scan.json
  compare_before_seq_scan.json
  compare_after_index_scan.json
  rewrite_sort_seq_shipments.json
  rewrite_index_ordered_shipments.json
  rewrite_access_idx_shipments.json
  rewrite_access_bitmap_shipments.json
  nl_inner_seq_heavy.json
  rewrite_nl_orders_lineitems.json
  rewrite_hash_orders_lineitems.json
  nested_loop_amplification.json
  nested_loop_misestimation.json
)
for f in "${FILES[@]}"; do
  cp "$SRC/$f" "$DST/$f"
  echo "synced $f"
done
echo "Done: $DST"
