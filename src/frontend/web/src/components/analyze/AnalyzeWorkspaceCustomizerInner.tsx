import type { AnalyzeWorkspaceLayoutApi } from '../../analyzeWorkspace/useAnalyzeWorkspaceLayout'
import {
  analyzeGuideSectionLabels,
  analyzeLowerBandLabels,
  analyzeWorkspaceRegionLabels,
  type AnalyzeGuideSectionId,
  type AnalyzeLowerBandColumnId,
  type AnalyzeWorkspacePresetId,
  type AnalyzeWorkspaceRegionId,
} from '../../analyzeWorkspace/analyzeWorkspaceModel'
import { WorkspaceSortableOrderList } from '../workspace/WorkspaceSortableOrderList'

const presets: { id: AnalyzeWorkspacePresetId; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Balanced', hint: 'All panels, default order' },
  { id: 'wideGraph', label: 'Wide graph', hint: 'Hide plan guide rail; maximize graph column' },
  { id: 'reviewer', label: 'Reviewer', hint: 'Findings → selected node → suggestions' },
  { id: 'focus', label: 'Focus', hint: 'Hide suggestions rail noise' },
  { id: 'detail', label: 'Detail', hint: 'Suggestions before findings' },
  { id: 'compact', label: 'Compact', hint: 'Hide summary, guide, suggestions' },
]

const regionOrder: AnalyzeWorkspaceRegionId[] = [
  'capture',
  'summary',
  'workspace',
  'guide',
  'findings',
  'suggestions',
  'selectedNode',
]

export function AnalyzeWorkspaceCustomizerInner({ api }: { api: AnalyzeWorkspaceLayoutApi }) {
  const {
    layout,
    setVisibility,
    setPreset,
    resetToDefaults,
    moveLowerBand,
    moveGuideSection,
    setGuideSectionOrder,
    setLowerBandOrder,
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
              onClick={() => setPreset(p.id)}
              title={p.hint}
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
        <div className="pqat-visibilityGrid pqat-visibilityGrid--analyze">
          {regionOrder.map((id) => (
            <label key={id} className="pqat-checkRow" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={layout.visibility[id]} onChange={(e) => setVisibility(id, e.target.checked)} />
              {analyzeWorkspaceRegionLabels[id]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="pqat-fieldset">
        <legend>Plan guide section order</legend>
        <p className="pqat-hint pqat-fieldHint">
          Drag the handle or use Up/Down. Order persists locally (and to your account when auth sync is on).
        </p>
        <WorkspaceSortableOrderList<AnalyzeGuideSectionId>
          items={layout.guideSectionOrder}
          getLabel={(id) => analyzeGuideSectionLabels[id]}
          onReorder={setGuideSectionOrder}
          onMoveUp={(i) => moveGuideSection(i, -1)}
          onMoveDown={(i) => moveGuideSection(i, 1)}
          ariaLabel="Plan guide section order"
        />
      </fieldset>

      <fieldset className="pqat-fieldset">
        <legend>Lower band column order</legend>
        <p className="pqat-hint pqat-fieldHint">
          On wide screens columns sit side-by-side; tablet widths auto-wrap. Drag or use Up/Down.
        </p>
        <WorkspaceSortableOrderList<AnalyzeLowerBandColumnId>
          items={layout.lowerBandOrder}
          getLabel={(id) => analyzeLowerBandLabels[id]}
          onReorder={setLowerBandOrder}
          onMoveUp={(i) => moveLowerBand(i, -1)}
          onMoveDown={(i) => moveLowerBand(i, 1)}
          ariaLabel="Lower band column order"
        />
      </fieldset>
    </div>
  )
}
