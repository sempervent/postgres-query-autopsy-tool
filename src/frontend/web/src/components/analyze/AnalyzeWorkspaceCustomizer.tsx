import { lazy, Suspense, useCallback, useState, type SyntheticEvent } from 'react'
import type { AnalyzeWorkspaceLayoutApi } from '../../analyzeWorkspace/useAnalyzeWorkspaceLayout'
import { CustomizerBodyFallback } from '../RouteFallback'

const AnalyzeWorkspaceCustomizerInner = lazy(() =>
  import('./AnalyzeWorkspaceCustomizerInner').then((m) => ({ default: m.AnalyzeWorkspaceCustomizerInner })),
)

export function AnalyzeWorkspaceCustomizer({ api }: { api: AnalyzeWorkspaceLayoutApi }) {
  const [bodyMounted, setBodyMounted] = useState(false)
  const onToggle = useCallback((e: SyntheticEvent<HTMLDetailsElement>) => {
    if ((e.target as HTMLDetailsElement).open) setBodyMounted(true)
  }, [])

  return (
    <details className="pqat-customizer pqat-customizer--chrome pqat-metaPanel" onToggle={onToggle}>
      <summary>Customize workspace layout</summary>
      {bodyMounted ? (
        <Suspense fallback={<CustomizerBodyFallback />}>
          <AnalyzeWorkspaceCustomizerInner api={api} />
        </Suspense>
      ) : null}
    </details>
  )
}
