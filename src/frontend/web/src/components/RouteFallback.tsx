/** Calm loading shell for lazy routes and heavy panels (Phase 44). */
export function RouteFallback({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="pqat-routeFallback" role="status" aria-live="polite" aria-busy="true">
      <div className="pqat-routeFallback__title">{label}</div>
      <div className="pqat-routeFallback__bar" aria-hidden />
      <span className="pqat-hint pqat-panelHintDense">Preparing panels and tools. This should be brief.</span>
    </div>
  )
}

export function CustomizerBodyFallback() {
  return (
    <div className="pqat-customizerFallback" role="status" aria-live="polite">
      <span className="pqat-customizerFallback__label">Loading layout controls…</span>
      <span className="pqat-customizerFallback__hint">Reorder lists and presets load on first open to keep the initial bundle small.</span>
    </div>
  )
}
