import type { Dispatch, SetStateAction } from 'react'
import type { PlanAnalysisResult } from '../../api/types'
import { ArtifactErrorBanner } from '../ArtifactErrorBanner'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'

type ExplainToggles = { analyze: boolean; verbose: boolean; buffers: boolean; costs: boolean }

export type AnalyzeCapturePanelProps = {
  input: string
  setInput: (v: string) => void
  queryText: string
  setQueryText: (v: string) => void
  explainToggles: ExplainToggles
  setExplainToggles: Dispatch<SetStateAction<ExplainToggles>>
  sendExplainMetadata: boolean
  setSendExplainMetadata: (v: boolean) => void
  recordedExplainCommand: string
  setRecordedExplainCommand: (v: string) => void
  suggestedExplainSql: string | null
  copySuggestedExplain: ReturnType<typeof useCopyFeedback>
  onAnalyze: () => void
  onClear: () => void
  onExport: (kind: 'md' | 'html' | 'json') => void
  loading: boolean
  loadingPersisted: boolean
  analysis: PlanAnalysisResult | null
  error: string | null
}

export function AnalyzeCapturePanel(props: AnalyzeCapturePanelProps) {
  const {
    input,
    setInput,
    queryText,
    setQueryText,
    explainToggles,
    setExplainToggles,
    sendExplainMetadata,
    setSendExplainMetadata,
    recordedExplainCommand,
    setRecordedExplainCommand,
    suggestedExplainSql,
    copySuggestedExplain,
    onAnalyze,
    onClear,
    onExport,
    loading,
    loadingPersisted,
    analysis,
    error,
  } = props

  return (
    <section className="pqat-panel pqat-panel--capture" style={{ minWidth: 0, padding: '18px 20px' }} aria-label="Plan capture input">
      <div className="pqat-eyebrow">Input</div>
      <h2>Input plan</h2>
      <p className="pqat-hint pqat-hint--tight">
        Paste raw <code>EXPLAIN (…, FORMAT JSON)</code> output: plain JSON, or <code>psql</code> tabular output with a <code>QUERY PLAN</code> header and optional line wraps ending in <code>+</code>. The server normalizes common shapes before parsing. Planner <code>COSTS</code> are optional; cost fields are detected from the JSON.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        <textarea
          className="pqat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          style={{ minHeight: 220 }}
          placeholder='JSON or psql QUERY PLAN cell text: [ { "Plan": { ... } } ]'
        />
        <details className="pqat-details pqat-details--meta">
          <summary>Optional: source SQL query</summary>
          <textarea
            className="pqat-textarea"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            spellCheck={false}
            style={{ minHeight: 140, marginTop: 8 }}
            placeholder="SELECT ... FROM ... WHERE ..."
          />
        </details>
        <details className="pqat-details pqat-details--meta" style={{ marginTop: 4 }}>
          <summary>Suggested EXPLAIN command (copy-paste)</summary>
          <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Wraps the optional source SQL below—no parsing, only text wrapping. Default matches a forensic-style capture; turn <strong>COSTS</strong> off to align with{' '}
            <code>EXPLAIN (…, COSTS false, …)</code> output.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
            <input type="checkbox" checked={sendExplainMetadata} onChange={(e) => setSendExplainMetadata(e.target.checked)} />
            Send EXPLAIN options with analyze request (stored in API result and exports)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 13 }}>
            {(
              [
                ['analyze', 'ANALYZE'],
                ['verbose', 'VERBOSE'],
                ['buffers', 'BUFFERS'],
                ['costs', 'COSTS'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={explainToggles[k]}
                  onChange={(e) => setExplainToggles((prev) => ({ ...prev, [k]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <label style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 10 }}>
            Optional: exact EXPLAIN command you ran (preserved verbatim when sent)
          </label>
          <textarea
            className="pqat-textarea"
            value={recordedExplainCommand}
            onChange={(e) => setRecordedExplainCommand(e.target.value)}
            spellCheck={false}
            style={{ minHeight: 56, marginTop: 6, fontSize: 12 }}
            placeholder="EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ..."
          />
          {suggestedExplainSql ? (
            <div style={{ marginTop: 10 }}>
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {suggestedExplainSql}
              </pre>
              <button
                type="button"
                className="pqat-btn pqat-btn--sm"
                onClick={() => suggestedExplainSql && void copySuggestedExplain.copy(suggestedExplainSql, 'Copied')}
                style={{ marginTop: 8 }}
              >
                Copy suggested EXPLAIN
              </button>
              {copySuggestedExplain.status ? (
                <span className="pqat-hint" style={{ marginLeft: 8, marginBottom: 0 }}>
                  {copySuggestedExplain.status}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="pqat-hint" style={{ marginTop: 10 }}>
              Add source SQL above to generate a suggested command.
            </p>
          )}
        </details>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="pqat-btn pqat-btn--primary"
          onClick={onAnalyze}
          disabled={loading || loadingPersisted || input.trim().length === 0}
          style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        <button type="button" className="pqat-btn pqat-btn--ghost" onClick={onClear}>
          Clear
        </button>

        <div style={{ flex: 1 }} />

        <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--ghost" disabled={!analysis} onClick={() => onExport('md')}>
          Export Markdown
        </button>
        <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--ghost" disabled={!analysis} onClick={() => onExport('html')}>
          Export HTML
        </button>
        <button type="button" className="pqat-btn pqat-btn--sm pqat-btn--ghost" disabled={!analysis} onClick={() => onExport('json')}>
          Export JSON
        </button>
      </div>

      {loadingPersisted ? (
        <div
          className="pqat-stateBanner pqat-stateBanner--loading"
          data-testid="analyze-persisted-loading"
        >
          <span className="pqat-stateBanner__title">Restoring snapshot</span>
          <div className="pqat-stateBanner__body">Opening shared analysis…</div>
        </div>
      ) : null}

      {error ? <ArtifactErrorBanner message={error} testId="analyze-page-error" /> : null}

      {!analysis ? (
        <div className="pqat-emptyHint pqat-hint" style={{ marginBottom: 0 }}>
          <span className="pqat-emptyHint__lead">Ready to analyze</span>
          Paste a plan JSON or psql <code>QUERY PLAN</code> output, then choose <b>Analyze</b>. The graph and findings
          load after the server parses the plan.
        </div>
      ) : null}
    </section>
  )
}
