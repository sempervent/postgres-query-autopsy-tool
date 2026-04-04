import type { AppConfig, PlanAnalysisResult } from '../../api/types'
import { getAnalysis } from '../../api/client'
import { ArtifactSharingPanel } from '../ArtifactSharingPanel'
import { formatDeclaredExplainOptionsLine, plannerCostsLabel } from '../../presentation/explainMetadataPresentation'
import { indexOverviewSummaryLine } from '../../presentation/indexInsightPresentation'
import {
  analyzeDeepLinkPath,
  buildAnalyzeDeepLinkSearchParams,
  shareArtifactLinkLabel,
  copyArtifactShareToast,
} from '../../presentation/artifactLinks'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'

export type AnalyzeSummaryCardProps = {
  analysis: PlanAnalysisResult
  appConfig: AppConfig | null
  sendExplainMetadata: boolean
  selectedNodeId: string | null
  locationPathname: string
  copyShareLink: ReturnType<typeof useCopyFeedback>
  setAnalysis: (a: PlanAnalysisResult) => void
}

export function AnalyzeSummaryCard(props: AnalyzeSummaryCardProps) {
  const { analysis, appConfig, sendExplainMetadata, selectedNodeId, locationPathname, copyShareLink, setAnalysis } = props

  const shareLinkUi = {
    label: shareArtifactLinkLabel(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
    toast: copyArtifactShareToast(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
  }

  return (
    <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid var(--border)' }} aria-label="Analysis summary">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>AnalysisId</div>
          <div style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{analysis.analysisId}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Summary</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            nodes={analysis.summary.totalNodeCount} depth={analysis.summary.maxDepth} severe={analysis.summary.severeFindingsCount} timing=
            {String(analysis.summary.hasActualTiming)} buffers={String(analysis.summary.hasBuffers)} plannerCosts=
            {String(analysis.summary.plannerCosts ?? 'unknown')}
          </div>
        </div>
      </div>
      {analysis.planInputNormalization ? (
        <div style={{ fontSize: 12, opacity: 0.82, marginTop: 10 }} aria-label="Plan input normalization">
          {analysis.planInputNormalization.kind === 'queryPlanTable'
            ? 'Normalized pasted QUERY PLAN output'
            : analysis.planInputNormalization.kind === 'rawJson'
              ? 'Parsed raw JSON directly'
              : `Input normalization: ${analysis.planInputNormalization.kind}`}
        </div>
      ) : null}
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={async () => {
            const path = analyzeDeepLinkPath(
              locationPathname,
              buildAnalyzeDeepLinkSearchParams({
                analysisId: analysis.analysisId,
                nodeId: selectedNodeId,
              }),
            )
            await copyShareLink.copy(`${window.location.origin}${path}`, shareLinkUi.toast)
          }}
          style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
        >
          {shareLinkUi.label}
        </button>
        {copyShareLink.status ? <span style={{ fontSize: 12, opacity: 0.85 }}>{copyShareLink.status}</span> : null}
      </div>
      <div style={{ fontSize: 11, opacity: 0.78, marginTop: 8, fontFamily: 'var(--mono)' }}>
        Snapshots persist in server SQLite; share links survive API restart if the database file is kept.
        {appConfig?.authEnabled ? ' In auth mode, opening an artifact may require identity; link-style access depends on sharing settings.' : ''}
      </div>
      <ArtifactSharingPanel
        authEnabled={appConfig?.authEnabled ?? false}
        authIdentityKind={appConfig?.authIdentityKind}
        authHelp={appConfig?.authHelp}
        kind="analysis"
        artifactId={analysis.analysisId}
        artifactAccess={analysis.artifactAccess}
        onSaved={async () => {
          const data = await getAnalysis(analysis.analysisId)
          setAnalysis(data)
        }}
      />
      <div
        style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13 }}
        aria-label="Plan source and EXPLAIN metadata"
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Plan source / EXPLAIN metadata</div>
        <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.92 }}>
          <li>Source query: {analysis.queryText?.trim() ? 'provided' : 'not provided'}</li>
          <li>{plannerCostsLabel(analysis.summary.plannerCosts)}</li>
          {analysis.explainMetadata?.options ? (
            <li>
              Declared EXPLAIN options (client): {formatDeclaredExplainOptionsLine(analysis.explainMetadata) ?? '—'}
            </li>
          ) : sendExplainMetadata ? (
            <li>No declared options in response (server omitted empty metadata).</li>
          ) : (
            <li>Declared EXPLAIN options were not sent with this request.</li>
          )}
          {analysis.explainMetadata?.sourceExplainCommand?.trim() ? (
            <li style={{ marginTop: 6 }}>
              <span style={{ display: 'block', fontSize: 11, opacity: 0.85 }}>Recorded command</span>
              <pre
                style={{
                  margin: '4px 0 0',
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {analysis.explainMetadata.sourceExplainCommand.trim()}
              </pre>
            </li>
          ) : null}
        </ul>
      </div>
      {analysis.summary.warnings?.length ? (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <b>Limitations:</b>
          <ul style={{ marginTop: 6 }}>
            {analysis.summary.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {(() => {
        const line = indexOverviewSummaryLine(analysis.indexOverview ?? null)
        if (!line) return null
        return (
          <div style={{ marginTop: 10, fontSize: 12, fontFamily: 'var(--mono)', opacity: 0.9 }} aria-label="Plan index overview">
            <b>Index posture:</b> {line}
          </div>
        )
      })()}
    </div>
  )
}
