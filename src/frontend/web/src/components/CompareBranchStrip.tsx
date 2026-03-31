import type { CompareBranchRow, CompareBranchViewModel } from '../presentation/compareBranchContext'
import { ClickableRow } from './ClickableRow'

export type CompareBranchStripProps = {
  model: CompareBranchViewModel
  onSelectPair: (pair: { a: string; b: string }) => void
  pairHeading?: string | null
}

function RowBadges({ row, side }: { row: CompareBranchRow; side: 'A' | 'B' }) {
  if (!row.sideUnmatched) return null
  return (
    <span
      style={{
        marginLeft: 8,
        fontFamily: 'var(--mono)',
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        opacity: 0.9,
      }}
    >
      {side === 'A' ? 'A-only' : 'B-only'}
    </span>
  )
}

function StaticBranchRow({ row, side }: { row: CompareBranchRow; side: 'A' | 'B' }) {
  return (
    <div
      style={{
        padding: '6px 8px',
        paddingLeft: 8 + row.depth * 12,
        borderRadius: 8,
        border: '1px solid var(--border)',
        opacity: row.isFocal ? 1 : 0.88,
        background: row.isFocal ? 'color-mix(in srgb, var(--accent-bg) 22%, transparent)' : 'transparent',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
      }}
    >
      <span style={{ fontWeight: row.isFocal ? 800 : 500 }}>{row.label}</span>
      <RowBadges row={row} side={side} />
      {!row.mappedPartnerId ? (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.75 }}>unmapped</span>
      ) : null}
    </div>
  )
}

function InteractiveBranchRow({
  row,
  side,
  onSelectPair,
}: {
  row: CompareBranchRow
  side: 'A' | 'B'
  onSelectPair: (pair: { a: string; b: string }) => void
}) {
  const pair = side === 'A' ? { a: row.nodeId, b: row.mappedPartnerId! } : { a: row.mappedPartnerId!, b: row.nodeId }
  return (
    <ClickableRow
      selected={row.isFocal}
      aria-label={`Plan ${side} branch row: ${row.label}`}
      onActivate={() => onSelectPair(pair)}
      style={{
        padding: '6px 8px',
        paddingLeft: 8 + row.depth * 12,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        <span style={{ fontWeight: row.isFocal ? 800 : 500 }}>{row.label}</span>
        <RowBadges row={row} side={side} />
      </div>
    </ClickableRow>
  )
}

function Column({
  title,
  rows,
  side,
  onSelectPair,
}: {
  title: string
  rows: CompareBranchRow[]
  side: 'A' | 'B'
  onSelectPair: (pair: { a: string; b: string }) => void
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.8, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row, idx) =>
          row.mappedPartnerId ? (
            <InteractiveBranchRow key={`${side}-${row.segment}-${idx}-${row.nodeId}`} row={row} side={side} onSelectPair={onSelectPair} />
          ) : (
            <StaticBranchRow key={`${side}-${row.segment}-${idx}-${row.nodeId}`} row={row} side={side} />
          ),
        )}
      </div>
    </div>
  )
}

export function CompareBranchStrip({ model, onSelectPair, pairHeading }: CompareBranchStripProps) {
  const hasPaths = model.pathRowsA.length > 0 && model.pathRowsB.length > 0

  return (
    <section
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--accent-bg) 8%, transparent)',
      }}
      aria-label="Compare branch context"
    >
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>Branch context</h3>
      {pairHeading ? <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>{pairHeading}</div> : null}
      {model.contextNote ? <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>{model.contextNote}</div> : null}

      {model.operatorShiftLabel ? (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 8, opacity: 0.9 }}>{model.operatorShiftLabel}</div>
      ) : null}

      {model.focalCues.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {model.focalCues.map((c) => (
            <span
              key={c}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
              }}
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}

      {hasPaths ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
            <Column title="Plan A — path to selected" rows={model.pathRowsA} side="A" onSelectPair={onSelectPair} />
            <Column title="Plan B — path to selected" rows={model.pathRowsB} side="B" onSelectPair={onSelectPair} />
          </div>
          {(model.childRowsA.length > 0 || model.childRowsB.length > 0) && (
            <>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.75, marginTop: 14, marginBottom: 8 }}>
                Downstream (immediate children)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
                <Column title="Plan A" rows={model.childRowsA} side="A" onSelectPair={onSelectPair} />
                <Column title="Plan B" rows={model.childRowsB} side="B" onSelectPair={onSelectPair} />
              </div>
            </>
          )}
        </>
      ) : null}
    </section>
  )
}
