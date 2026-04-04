#!/usr/bin/env node
/**
 * Phase 51: fail if e2e/fixtures diverge from backend unit postgres-json copies.
 * Run from repo root: `node scripts/check-e2e-fixtures.mjs`
 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = [
  'simple_seq_scan.json',
  'compare_before_seq_scan.json',
  'compare_after_index_scan.json',
]

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

let ok = true
for (const f of files) {
  const src = join(
    root,
    'tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/postgres-json',
    f,
  )
  const dst = join(root, 'src/frontend/web/e2e/fixtures', f)
  if (!existsSync(dst)) {
    console.error(`missing e2e fixture: ${dst}`)
    ok = false
    continue
  }
  if (sha256(src) !== sha256(dst)) {
    console.error(`e2e fixture out of sync with backend: ${f}`)
    console.error(`  run: ./scripts/sync-e2e-fixtures.sh`)
    ok = false
  }
}

if (!ok) process.exit(1)
console.log('e2e fixtures match backend postgres-json copies.')
