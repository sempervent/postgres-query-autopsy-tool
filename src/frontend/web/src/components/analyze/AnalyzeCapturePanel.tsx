import type { Dispatch, SetStateAction } from 'react'
import type { PlanAnalysisResult } from '../../api/types'
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
    <section style={{ minWidth: 0 }} aria-label="Plan capture input">
      <h2>Input plan</h2>
      <p style={{ opacity: 0.85, marginTop: -8, marginBottom: 12 }}>
        Paste raw <code>EXPLAIN (…, FORMAT JSON)</code> output: plain JSON, or <code>psql</code> tabular output with a <code>QUERY PLAN</code> header and optional line wraps ending in <code>+</code>. The server normalizes common shapes before parsing. Planner <code>COSTS</code> are optional; cost fields are detected from the JSON.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 220,
            padding: 12,
            borderRadius: 12,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-h)',
            fontFamily: 'var(--mono)',
          }}
          placeholder='JSON or psql QUERY PLAN cell text: [ { "Plan": { ... } } ]'
        />
        <details>
          <summary style={{ cursor: 'pointer', opacity: 0.9 }}>Optional: source SQL query</summary>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 140,
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
              fontFamily: 'var(--mono)',
            }}
            placeholder="SELECT ... FROM ... WHERE ..."
          />
        </details>
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', opacity: 0.9 }}>Suggested EXPLAIN command (copy-paste)</summary>
          <p style={{ fontSize: 12, opacity: 0.82, marginTop: 8, marginBottom: 0 }}>
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
            value={recordedExplainCommand}
            onChange={(e) => setRecordedExplainCommand(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 56,
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-h)',
              fontFamily: 'var(--mono)',
              fontSize: 12,
            }}
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
                onClick={() => suggestedExplainSql && void copySuggestedExplain.copy(suggestedExplainSql, 'Copied')}
                style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                Copy suggested EXPLAIN
              </button>
              {copySuggestedExplain.status ? (
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.85 }}>{copySuggestedExplain.status}</span>
              ) : null}
            </div>
          ) : (
            <p style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>Add source SQL above to generate a suggested command.</p>
          )}
        </details>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onAnalyze}
          disabled={loading || loadingPersisted || input.trim().length === 0}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--accent-border)',
            background: 'var(--accent-bg)',
            color: 'var(--text-h)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        <button
          onClick={onClear}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-h)',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>

        <div style={{ flex: 1 }} />

        <button disabled={!analysis} onClick={() => onExport('md')} style={{ padding: '8px 10px', borderRadius: 10 }}>
          Export Markdown
        </button>
        <button disabled={!analysis} onClick={() => onExport('html')} style={{ padding: '8px 10px', borderRadius: 10 }}>
          Export HTML
        </button>
        <button disabled={!analysis} onClick={() => onExport('json')} style={{ padding: '8px 10px', borderRadius: 10 }}>
          Export JSON
        </button>
      </div>

      {loadingPersisted ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
          Opening shared analysis…
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid #f59e0b', color: 'var(--text-h)' }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {!analysis ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
          Paste a plan and click <b>Analyze</b>.
        </div>
      ) : null}
    </section>
  )
}
