import { lazy, Suspense, useCallback, useState, type SyntheticEvent } from 'react'
import type { CompareWorkspaceLayoutApi } from '../../compareWorkspace/useCompareWorkspaceLayout'
import { CustomizerBodyFallback } from '../RouteFallback'

const CompareWorkspaceCustomizerInner = lazy(() =>
  import('./CompareWorkspaceCustomizerInner').then((m) => ({ default: m.CompareWorkspaceCustomizerInner })),
)

export function CompareWorkspaceCustomizer({ api }: { api: CompareWorkspaceLayoutApi }) {
  const [bodyMounted, setBodyMounted] = useState(false)
  const onToggle = useCallback((e: SyntheticEvent<HTMLDetailsElement>) => {
    if ((e.target as HTMLDetailsElement).open) setBodyMounted(true)
  }, [])

  return (
    <details className="pqat-customizer" onToggle={onToggle}>
      <summary>Customize workspace</summary>
      {bodyMounted ? (
        <Suspense fallback={<CustomizerBodyFallback />}>
          <CompareWorkspaceCustomizerInner api={api} />
        </Suspense>
      ) : null}
    </details>
  )
}
