import type { CompareBranchViewModel } from '../../presentation/compareBranchContext'
import { CompareBranchStrip } from '../CompareBranchStrip'
import { CompareSelectedPairPanel, type CompareSelectedPairPanelProps } from './CompareSelectedPairPanel'

export type ComparePairColumnProps = {
  showBranchStrip: boolean
  showSelectedPair: boolean
  branchViewModel: CompareBranchViewModel | null
  branchPairHeading: string | null
  setSelectedPair: (p: { a: string; b: string }) => void
  selectedPairProps: CompareSelectedPairPanelProps
}

export function ComparePairColumn(props: ComparePairColumnProps) {
  const { showBranchStrip, showSelectedPair, branchViewModel, branchPairHeading, setSelectedPair, selectedPairProps } = props

  const hasAny = showBranchStrip || showSelectedPair
  if (!hasAny) {
    return (
      <div className="pqat-panel pqat-panel--tool pqat-hint pqat-panelPad--sm pqat-panelHintDense">
        Branch context and selected pair detail are hidden. Use <b>Customize workspace</b> to restore the compare visual context or pair
        inspector.
      </div>
    )
  }

  return (
    <div className="pqat-panel pqat-panel--workspace pqat-panelPad--md pqat-workspaceColumn">
      {showBranchStrip && branchViewModel ? (
        <CompareBranchStrip model={branchViewModel} onSelectPair={setSelectedPair} pairHeading={branchPairHeading} />
      ) : null}
      {showSelectedPair ? <CompareSelectedPairPanel {...selectedPairProps} /> : null}
    </div>
  )
}
