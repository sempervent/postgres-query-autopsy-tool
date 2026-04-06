import type { NodeDelta, PlanComparisonResult } from '../../api/types'
import { pairShortLabel } from '../../presentation/nodeLabels'
import { pairReferenceText } from '../../presentation/nodeReferences'
import { compareWhatChangedMostCopy } from '../../presentation/comparePresentation'
import { pairContinuitySectionTitle } from '../../presentation/compareContinuityPresentation'
import { ClickableRow } from '../ClickableRow'
import { ReferenceCopyButton } from '../ReferenceCopyButton'
import { prefetchCompareSelectedPairHeavySections } from './prefetchCompareSelectedPairHeavySections'

export type CompareTopChangesPanelProps = {
  worsened: NodeDelta[]
  improved: NodeDelta[]
  byIdA: Map<string, PlanComparisonResult['planA']['nodes'][number]>
  byIdB: Map<string, PlanComparisonResult['planB']['nodes'][number]>
  pairForDelta: (nodeIdA: string, nodeIdB: string) => import('../../api/types').NodePairDetail | null
  pairSelected: (nodeIdA: string, nodeIdB: string) => boolean
  setSelectedPair: (p: { a: string; b: string }) => void
  copyNav: { copy: (text: string, ok: string) => Promise<void> }
}

export function CompareTopChangesPanel(props: CompareTopChangesPanelProps) {
  const { worsened, improved, byIdA, byIdB, pairForDelta, pairSelected, setSelectedPair, copyNav } = props
  const whatChangedMost = compareWhatChangedMostCopy()

  return (
    <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
      <h3 style={{ marginTop: 0 }}>{whatChangedMost.title}</h3>
      <div style={{ marginTop: -6, opacity: 0.85 }}>{whatChangedMost.subtitle}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 10 }}>
        {worsened[0] ? (
          (() => {
            const w0 = worsened[0]
            const p0 = pairForDelta(w0.nodeIdA, w0.nodeIdB)
            const lab = p0 ? pairShortLabel(p0, byIdA, byIdB) : `${w0.nodeTypeA} → ${w0.nodeTypeB}`
            return (
              <ClickableRow
                selectedEmphasis="accent-bar"
                selected={pairSelected(w0.nodeIdA, w0.nodeIdB)}
                aria-label={`Top worsened: ${lab}`}
                onActivate={() => setSelectedPair({ a: w0.nodeIdA, b: w0.nodeIdB })}
                onPointerIntent={prefetchCompareSelectedPairHeavySections}
                className="pqat-topChangeRow pqat-topChangeRow--worsened"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>Top worsened</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{lab}</div>
                    {p0?.regionContinuityHint ? (
                      <>
                        <div className="pqat-readoutKicker" style={{ marginTop: 8, fontSize: 11, opacity: 0.88 }}>
                          {pairContinuitySectionTitle(p0.regionContinuityHint)}
                        </div>
                        <div
                          className="pqat-hint"
                          style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)' }}
                        >
                          {p0.regionContinuityHint}
                        </div>
                      </>
                    ) : null}
                  </div>
                  {p0 ? (
                    <ReferenceCopyButton
                      aria-label="Copy pair reference for top worsened"
                      onCopy={() => copyNav.copy(pairReferenceText(p0, byIdA, byIdB), 'Copied pair reference')}
                    />
                  ) : null}
                </div>
              </ClickableRow>
            )
          })()
        ) : null}
        {improved[0] ? (
          (() => {
            const i0 = improved[0]
            const p0 = pairForDelta(i0.nodeIdA, i0.nodeIdB)
            const lab = p0 ? pairShortLabel(p0, byIdA, byIdB) : `${i0.nodeTypeA} → ${i0.nodeTypeB}`
            return (
              <ClickableRow
                selectedEmphasis="accent-bar"
                selected={pairSelected(i0.nodeIdA, i0.nodeIdB)}
                aria-label={`Top improved: ${lab}`}
                onActivate={() => setSelectedPair({ a: i0.nodeIdA, b: i0.nodeIdB })}
                onPointerIntent={prefetchCompareSelectedPairHeavySections}
                className="pqat-topChangeRow pqat-topChangeRow--improved"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.85 }}>Top improved</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{lab}</div>
                    {p0?.regionContinuityHint ? (
                      <>
                        <div className="pqat-readoutKicker" style={{ marginTop: 8, fontSize: 11, opacity: 0.88 }}>
                          {pairContinuitySectionTitle(p0.regionContinuityHint)}
                        </div>
                        <div
                          className="pqat-hint"
                          style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)' }}
                        >
                          {p0.regionContinuityHint}
                        </div>
                      </>
                    ) : null}
                  </div>
                  {p0 ? (
                    <ReferenceCopyButton
                      aria-label="Copy pair reference for top improved"
                      onCopy={() => copyNav.copy(pairReferenceText(p0, byIdA, byIdB), 'Copied pair reference')}
                    />
                  ) : null}
                </div>
              </ClickableRow>
            )
          })()
        ) : null}
      </div>
      {!worsened.length && !improved.length ? (
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          No top-changes were emitted. This usually means missing timing/buffer evidence or very small plans.
        </div>
      ) : null}
    </div>
  )
}
