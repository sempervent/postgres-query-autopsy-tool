import { useEffect, useState } from 'react'

/**
 * Responsive tiers for Analyze/Compare workspace grids (Phase 42).
 * - narrow: single-column stacks (phone / small tablet)
 * - medium: side-by-side graph+guide and auto-fit lower/compare columns (tablet / small laptop)
 * - wide: explicit multi-column grids and wider graph emphasis (desktop+)
 */
export type WorkspaceLayoutTier = 'narrow' | 'medium' | 'wide'

const WIDE_MQ = '(min-width: 1320px)'
const MEDIUM_MQ = '(min-width: 900px)'

function computeTier(): WorkspaceLayoutTier {
  if (typeof globalThis === 'undefined') return 'wide'
  const mm = globalThis.matchMedia
  if (typeof mm !== 'function') return 'wide'
  try {
    if (mm.call(globalThis, WIDE_MQ).matches) return 'wide'
    if (mm.call(globalThis, MEDIUM_MQ).matches) return 'medium'
    return 'narrow'
  } catch {
    return 'wide'
  }
}

export function useWorkspaceLayoutTier(): WorkspaceLayoutTier {
  const [tier, setTier] = useState<WorkspaceLayoutTier>(computeTier)
  useEffect(() => {
    if (typeof globalThis === 'undefined' || typeof globalThis.matchMedia !== 'function') return
    let mqWide: MediaQueryList
    let mqMed: MediaQueryList
    try {
      mqWide = globalThis.matchMedia(WIDE_MQ)
      mqMed = globalThis.matchMedia(MEDIUM_MQ)
    } catch {
      return
    }
    const sync = () => setTier(computeTier())
    mqWide.addEventListener('change', sync)
    mqMed.addEventListener('change', sync)
    return () => {
      mqWide.removeEventListener('change', sync)
      mqMed.removeEventListener('change', sync)
    }
  }, [])
  return tier
}
