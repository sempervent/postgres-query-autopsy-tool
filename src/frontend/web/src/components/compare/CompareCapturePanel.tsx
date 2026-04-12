import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { PlanComparisonResult } from '../../api/types'
import type { CompareWorkspaceLayoutApi } from '../../compareWorkspace/useCompareWorkspaceLayout'
import { CompareWorkspaceCustomizer } from './CompareWorkspaceCustomizer'

type ExplainToggles = { analyze: boolean; verbose: boolean; buffers: boolean; costs: boolean }

export type CompareCapturePanelProps = {
  workspaceApi: CompareWorkspaceLayoutApi
  planA: string
  planB: string
  setPlanA: (v: string) => void
  setPlanB: (v: string) => void
  queryTextA: string
  queryTextB: string
  setQueryTextA: (v: string) => void
  setQueryTextB: (v: string) => void
  sendCompareExplainMetadata: boolean
  setSendCompareExplainMetadata: (v: boolean) => void
  compareExplainToggles: ExplainToggles
  setCompareExplainToggles: Dispatch<SetStateAction<ExplainToggles>>
  recordedCommandA: string
  recordedCommandB: string
  setRecordedCommandA: (v: string) => void
  setRecordedCommandB: (v: string) => void
  suggestedExplainA: string
  suggestedExplainB: string
  includeDiagnostics: boolean
  setIncludeDiagnostics: (v: boolean) => void
  loading: boolean
  loadingPersistedComparison: boolean
  onCompare: () => void
  onClear: () => void
  examplePicker?: ReactNode
  /** When set, user has a comparison result (export uses pasted plans when both sides are filled, else the loaded snapshot). */
  comparison: PlanComparisonResult | null
  exportCompareBusyKind?: 'md' | 'html' | 'json' | null
  exportCompareHint?: string | null
  canExportCompareReports?: boolean
  /** True when plan inputs are empty but a comparison is loaded (reopen-from-link export path). */
  exportUsesSnapshot?: boolean
  onExportCompare?: (kind: 'md' | 'html' | 'json') => void
}

export function CompareCapturePanel(props: CompareCapturePanelProps) {
  const {
    workspaceApi,
    planA,
    planB,
    setPlanA,
    setPlanB,
    queryTextA,
    queryTextB,
    setQueryTextA,
    setQueryTextB,
    sendCompareExplainMetadata,
    setSendCompareExplainMetadata,
    compareExplainToggles,
    setCompareExplainToggles,
    recordedCommandA,
    recordedCommandB,
    setRecordedCommandA,
    setRecordedCommandB,
    suggestedExplainA,
    suggestedExplainB,
    includeDiagnostics,
    setIncludeDiagnostics,
    loading,
    loadingPersistedComparison,
    onCompare,
    onClear,
    examplePicker,
    comparison,
    exportCompareBusyKind = null,
    exportCompareHint = null,
    canExportCompareReports = false,
    exportUsesSnapshot = false,
    onExportCompare,
  } = props

  const compareDisabled = loading || loadingPersistedComparison || planA.trim().length === 0 || planB.trim().length === 0
  const exportBusy = exportCompareBusyKind !== null
  const exportDisabled = exportBusy || !canExportCompareReports || !onExportCompare

  return (
    <div className="pqat-captureStack">
      <div>
        <div className="pqat-eyebrow">Workspace</div>
        <h2 className="pqat-captureTitle">Plan inputs</h2>
        <p className="pqat-help-inline" data-testid="compare-capture-guide-hint">
          <strong>Start here:</strong> Plan A/B are your raw captures. Everything below <b>Compare</b> is the diff readout—open{' '}
          <strong>How to use Compare</strong> when you want definitions.
        </p>
        {examplePicker ? (
          <div data-testid="compare-example-entry" style={{ marginBottom: 8 }}>
            <p className="pqat-hint" style={{ marginBottom: 6 }}>
              <strong>No plans handy?</strong> Load a paired sample—then read the <b>Change briefing</b> lead line first.
            </p>
            {examplePicker}
          </div>
        ) : null}
        <p className="pqat-hint pqat-hint--tight">
          Paste two plans to diff. Layout matches Analyze (customize panels from the workspace menu).
        </p>
      </div>
      <CompareWorkspaceCustomizer api={workspaceApi} />
      <div className="pqat-formGrid2">
        <section>
          <h3 className="pqat-sectionHeading">Plan A</h3>
          <p className="pqat-hint" style={{ marginTop: -4, marginBottom: 8 }}>
            “Before” (baseline). Paste JSON or <code>psql</code> <code>QUERY PLAN</code> cell text (same normalization as Analyze).
          </p>
          <textarea
            className="pqat-textarea pqat-textarea--plan"
            value={planA}
            onChange={(e) => setPlanA(e.target.value)}
            spellCheck={false}
            placeholder="Plan A: JSON or QUERY PLAN output"
            data-testid="compare-plan-a-text"
          />
        </section>

        <section>
          <h3 className="pqat-sectionHeading">Plan B</h3>
          <p className="pqat-hint" style={{ marginTop: -4, marginBottom: 8 }}>
            “After” (changed plan). Same input shapes as Plan A.
          </p>
          <textarea
            className="pqat-textarea pqat-textarea--plan"
            value={planB}
            onChange={(e) => setPlanB(e.target.value)}
            spellCheck={false}
            placeholder="Plan B: JSON or QUERY PLAN output"
            data-testid="compare-plan-b-text"
          />
        </section>
      </div>

      <details className="pqat-details pqat-details--muted pqat-details--meta">
        <summary>Optional: source SQL + EXPLAIN metadata (per side)</summary>
        <div className="pqat-detailsBody">
          <p className="pqat-hint">
            Saved with this comparison in the app database. Toggle options apply to <b>both</b> sides; recorded commands are separate per side.
          </p>
          <label className="pqat-checkRow pqat-checkRow--tight">
            <input
              type="checkbox"
              checked={sendCompareExplainMetadata}
              onChange={(e) => setSendCompareExplainMetadata(e.target.checked)}
            />
            Send EXPLAIN options with compare request
          </label>
          <div className="pqat-checkGroup">
            {(
              [
                ['analyze', 'ANALYZE'],
                ['verbose', 'VERBOSE'],
                ['buffers', 'BUFFERS'],
                ['costs', 'COSTS'],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={compareExplainToggles[k]}
                  onChange={(e) => setCompareExplainToggles((prev) => ({ ...prev, [k]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="pqat-formGrid2 pqat-formGrid2--tight">
            <label className="pqat-fieldLabel">
              Source SQL — Plan A
              <textarea
                className="pqat-textarea pqat-textarea--sql"
                value={queryTextA}
                onChange={(e) => setQueryTextA(e.target.value)}
                spellCheck={false}
                placeholder="SELECT ... (plan A)"
              />
            </label>
            <label className="pqat-fieldLabel">
              Source SQL — Plan B
              <textarea
                className="pqat-textarea pqat-textarea--sql"
                value={queryTextB}
                onChange={(e) => setQueryTextB(e.target.value)}
                spellCheck={false}
                placeholder="SELECT ... (plan B)"
              />
            </label>
          </div>
          <div className="pqat-formGrid2 pqat-formGrid2--tight">
            <label className="pqat-fieldLabel pqat-fieldLabel--sm">
              Recorded EXPLAIN — A
              <textarea
                className="pqat-textarea pqat-textarea--command"
                value={recordedCommandA}
                onChange={(e) => setRecordedCommandA(e.target.value)}
                spellCheck={false}
              />
            </label>
            <label className="pqat-fieldLabel pqat-fieldLabel--sm">
              Recorded EXPLAIN — B
              <textarea
                className="pqat-textarea pqat-textarea--command"
                value={recordedCommandB}
                onChange={(e) => setRecordedCommandB(e.target.value)}
                spellCheck={false}
              />
            </label>
          </div>
          {suggestedExplainA || suggestedExplainB ? (
            <div className="pqat-formGrid2 pqat-formGrid2--tight">
              {suggestedExplainA ? (
                <pre className="pqat-monoPre">{suggestedExplainA}</pre>
              ) : (
                <div className="pqat-placeholderHint">Add SQL for A to suggest EXPLAIN.</div>
              )}
              {suggestedExplainB ? (
                <pre className="pqat-monoPre">{suggestedExplainB}</pre>
              ) : (
                <div className="pqat-placeholderHint">Add SQL for B to suggest EXPLAIN.</div>
              )}
            </div>
          ) : null}
        </div>
      </details>

      <div className="pqat-actionRow">
        <button type="button" className="pqat-btn pqat-btn--primary" onClick={onCompare} disabled={compareDisabled}>
          {loading ? 'Comparing…' : 'Compare'}
        </button>
        <button type="button" className="pqat-btn pqat-btn--ghost" onClick={onClear}>
          Clear
        </button>
        <details className="pqat-details pqat-details--inline pqat-details--muted">
          <summary>Advanced</summary>
          <div className="pqat-detailsBody">
            <label className="pqat-checkRow">
              <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
              include matcher diagnostics
            </label>
          </div>
        </details>
      </div>

      {comparison && onExportCompare ? (
        <div className="pqat-handoffBand" data-testid="compare-export-report-row">
          <div className="pqat-eyebrow" style={{ marginBottom: 4 }}>
            Take with you
          </div>
          <p className="pqat-hint pqat-hint--tight" style={{ marginBottom: 6 }} data-testid="compare-export-handoff-kicker">
            Choose a format — each option is a complete handoff from this screen.
          </p>
          <p className="pqat-hint pqat-hint--tight" style={{ marginBottom: 6 }} data-testid="compare-export-hint">
            {exportUsesSnapshot ? (
              <span data-testid="compare-export-snapshot-cue">
                From a saved link, the file matches this view — plan boxes can stay empty.
              </span>
            ) : (
              <>Otherwise the server rebuilds from both plan boxes when they’re filled.</>
            )}
          </p>
          <p className="pqat-formatLegend" data-testid="compare-export-format-legend">
            <strong>Markdown</strong> — narrative & tickets · <strong>HTML</strong> — print or attach ·{' '}
            <strong>JSON</strong> — full comparison snapshot
          </p>
          <div className="pqat-actionRow">
            <button
              type="button"
              className="pqat-btn pqat-btn--sm pqat-btn--ghost"
              disabled={exportDisabled}
              data-testid="compare-export-markdown"
              title={
                canExportCompareReports
                  ? 'Download Markdown compare report'
                  : 'Run Compare or open a saved comparison first.'
              }
              onClick={() => onExportCompare('md')}
            >
              {exportCompareBusyKind === 'md' ? 'Preparing…' : 'Markdown'}
            </button>
            <button
              type="button"
              className="pqat-btn pqat-btn--sm pqat-btn--ghost"
              disabled={exportDisabled}
              data-testid="compare-export-html"
              title={canExportCompareReports ? 'Download HTML compare report' : undefined}
              onClick={() => onExportCompare('html')}
            >
              {exportCompareBusyKind === 'html' ? 'Preparing…' : 'HTML'}
            </button>
            <button
              type="button"
              className="pqat-btn pqat-btn--sm pqat-btn--ghost"
              disabled={exportDisabled}
              data-testid="compare-export-json"
              title={canExportCompareReports ? 'Download JSON comparison snapshot' : undefined}
              onClick={() => onExportCompare('json')}
            >
              {exportCompareBusyKind === 'json' ? 'Preparing…' : 'JSON'}
            </button>
          </div>
          {exportCompareHint ? (
            <p
              className="pqat-hint"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              style={{ marginTop: 8, color: 'var(--text-secondary)' }}
              data-testid="compare-export-status"
            >
              {exportCompareHint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
