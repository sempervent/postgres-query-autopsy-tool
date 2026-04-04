import type { AnalyzeWorkspaceLayoutApi } from '../../analyzeWorkspace/useAnalyzeWorkspaceLayout'
import {
  analyzeGuideSectionLabels,
  analyzeLowerBandLabels,
  analyzeWorkspaceRegionLabels,
  type AnalyzeWorkspacePresetId,
  type AnalyzeWorkspaceRegionId,
} from '../../analyzeWorkspace/analyzeWorkspaceModel'

const presets: { id: AnalyzeWorkspacePresetId; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Balanced', hint: 'All panels, default order' },
  { id: 'focus', label: 'Focus', hint: 'Hide suggestions rail noise; findings + node first' },
  { id: 'detail', label: 'Detail', hint: 'Suggestions before findings' },
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

export function AnalyzeWorkspaceCustomizer({ api }: { api: AnalyzeWorkspaceLayoutApi }) {
  const { layout, setVisibility, setPreset, resetToDefaults, moveLowerBand, moveGuideSection } = api

  return (
    <details style={{ fontSize: 13 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, opacity: 0.92 }}>Customize workspace</summary>
      <div
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--bg) 94%, var(--accent-bg))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                title={p.hint}
                style={{
                  padding: '6px 10px',
                  borderRadius: 10,
                  border: layout.preset === p.id ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  background: layout.preset === p.id ? 'var(--accent-bg)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => resetToDefaults()}
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}
            >
              Reset to defaults
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>Panel visibility</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {regionOrder.map((id) => (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={layout.visibility[id]}
                  onChange={(e) => setVisibility(id, e.target.checked)}
                />
                {analyzeWorkspaceRegionLabels[id]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>Plan guide section order</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {layout.guideSectionOrder.map((sid, i) => (
              <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 140, fontSize: 12 }}>{analyzeGuideSectionLabels[sid]}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveGuideSection(i, -1)}
                  style={{ padding: '4px 8px', borderRadius: 8, cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.45 : 1 }}
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={i >= layout.guideSectionOrder.length - 1}
                  onClick={() => moveGuideSection(i, 1)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 8,
                    cursor: i >= layout.guideSectionOrder.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: i >= layout.guideSectionOrder.length - 1 ? 0.45 : 1,
                  }}
                >
                  Down
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>Lower band column order (desktop)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {layout.lowerBandOrder.map((col, i) => (
              <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 140, fontSize: 12 }}>{analyzeLowerBandLabels[col]}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveLowerBand(i, -1)}
                  style={{ padding: '4px 8px', borderRadius: 8, cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.45 : 1 }}
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={i >= layout.lowerBandOrder.length - 1}
                  onClick={() => moveLowerBand(i, 1)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 8,
                    cursor: i >= layout.lowerBandOrder.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: i >= layout.lowerBandOrder.length - 1 ? 0.45 : 1,
                  }}
                >
                  Down
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}
