import { lazy, Suspense, type ReactNode } from 'react'
import type { AnalyzePlanGraphCoreProps } from './AnalyzePlanGraphCore'

const AnalyzePlanGraphCore = lazy(() =>
  import('./AnalyzePlanGraphCore').then((m) => ({ default: m.AnalyzePlanGraphCore })),
)

/** Warm the graph + React Flow chunk (hover Graph toggle, idle callback, etc.). */
export function prefetchAnalyzePlanGraph() {
  void import('./AnalyzePlanGraphCore')
}

export function PlanGraphSkeleton({ graphHeight = 'clamp(360px, 48vh, 620px)' }: { graphHeight?: string }) {
  return (
    <div
      className="pqat-graphFrame pqat-graphSkeleton"
      style={{ height: graphHeight, minHeight: 320 }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading plan graph"
    >
      <div className="pqat-graphSkeleton__toolbar" aria-hidden>
        <div className="pqat-graphSkeleton__chip" />
        <div className="pqat-graphSkeleton__chip" style={{ width: 72 }} />
        <div className="pqat-graphSkeleton__chip" style={{ width: 96 }} />
      </div>
      <div className="pqat-graphSkeleton__canvas" aria-hidden />
      <p className="pqat-graphSkeleton__hint">
        <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text-h)', fontSize: '0.8125rem' }}>Loading graph…</strong>
        <span className="pqat-hint pqat-panelHintDense" style={{ margin: 0 }}>
          React Flow and layout are initializing. The rest of the workspace stays usable.
        </span>
      </p>
    </div>
  )
}

export function AnalyzePlanGraphLazy(props: AnalyzePlanGraphCoreProps & { fallback?: ReactNode }) {
  const { fallback, ...rest } = props
  return (
    <Suspense fallback={fallback ?? <PlanGraphSkeleton graphHeight={rest.graphHeight} />}>
      <AnalyzePlanGraphCore {...rest} />
    </Suspense>
  )
}
