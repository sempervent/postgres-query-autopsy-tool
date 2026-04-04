import type { CompareWorkspaceLayoutApi } from '../../compareWorkspace/useCompareWorkspaceLayout'
import {
  compareLeftStackLabels,
  compareSummarySectionLabels,
  compareWorkspaceRegionLabels,
  type CompareLeftStackId,
  type CompareSummarySectionId,
  type CompareWorkspacePresetId,
  type CompareWorkspaceRegionId,
} from '../../compareWorkspace/compareWorkspaceModel'
import { WorkspaceSortableOrderList } from '../workspace/WorkspaceSortableOrderList'

const presets: { id: CompareWorkspacePresetId; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Balanced', hint: 'Default layout' },
  { id: 'wideGraph', label: 'Wide pair', hint: 'Pair + branch column first; hide intro' },
  { id: 'review', label: 'Review', hint: 'Pair first; trim intro & summary suggestions' },
  { id: 'diffHeavy', label: 'Diff-heavy', hint: 'Findings diff above worsened/improved' },
  { id: 'compact', label: 'Compact', hint: 'Hide intro, capture context, unmatched, narrative block' },
]

const regionOrder: CompareWorkspaceRegionId[] = [
  'intro',
  'input',
  'topChanges',
  'summaryCards',
  'summaryCaptureContext',
  'summaryIndexChanges',
  'summaryCompareSuggestions',
  'summaryMeta',
  'worsenedImproved',
  'findingsDiff',
  'unmatchedNodes',
  'branchStrip',
  'selectedPair',
]

export function CompareWorkspaceCustomizerInner({ api }: { api: CompareWorkspaceLayoutApi }) {
  const {
    layout,
    setVisibility,
    setPreset,
    resetToDefaults,
    moveSummarySection,
    moveLeftStack,
    setSummarySectionOrder,
    setLeftStackOrder,
    swapMainColumns,
  } = api

  return (
    <div className="pqat-customizer__body">
      <fieldset className="pqat-fieldset">
        <legend>Presets</legend>
        <div className="pqat-presetRow">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => setPreset(p.id)}
              className={`pqat-presetBtn${layout.preset === p.id ? ' pqat-presetBtn--active' : ''}`}
            >
              {p.label}
            </button>
          ))}
          <button type="button" className="pqat-presetBtn" onClick={() => resetToDefaults()}>
            Reset to defaults
          </button>
        </div>
      </fieldset>

      <fieldset className="pqat-fieldset">
        <legend>Panel visibility</legend>
        <div className="pqat-visibilityGrid">
          {regionOrder.map((id) => (
            <label key={id} className="pqat-checkRow" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={layout.visibility[id]} onChange={(e) => setVisibility(id, e.target.checked)} />
              {compareWorkspaceRegionLabels[id]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="pqat-fieldset">
        <legend>Summary column section order</legend>
        <p className="pqat-hint pqat-fieldHint">Drag the handle or use Up/Down.</p>
        <WorkspaceSortableOrderList<CompareSummarySectionId>
          items={layout.summarySectionOrder}
          getLabel={(id) => compareSummarySectionLabels[id]}
          onReorder={setSummarySectionOrder}
          onMoveUp={(i) => moveSummarySection(i, -1)}
          onMoveDown={(i) => moveSummarySection(i, 1)}
          ariaLabel="Compare summary section order"
        />
      </fieldset>

      <fieldset className="pqat-fieldset">
        <legend>Navigator column block order</legend>
        <p className="pqat-hint pqat-fieldHint">Drag the handle or use Up/Down.</p>
        <WorkspaceSortableOrderList<CompareLeftStackId>
          items={layout.leftStackOrder}
          getLabel={(id) => compareLeftStackLabels[id]}
          onReorder={setLeftStackOrder}
          onMoveUp={(i) => moveLeftStack(i, -1)}
          onMoveDown={(i) => moveLeftStack(i, 1)}
          ariaLabel="Compare navigator block order"
        />
      </fieldset>

      <div>
        <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--ghost" onClick={() => swapMainColumns()}>
          Swap main columns (navigator ↔ pair detail)
        </button>
        <div className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
          Current: {layout.mainColumnOrder[0] === 'navigator' ? 'Navigator | Pair' : 'Pair | Navigator'}
        </div>
      </div>
    </div>
  )
}
