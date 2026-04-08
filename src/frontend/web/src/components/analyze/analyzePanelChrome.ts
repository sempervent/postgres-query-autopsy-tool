import type { CSSProperties } from 'react'

/** Plan guide rail: class + scroll bounds (layout-specific). */
export const planGuideRailClassName = 'pqat-panel pqat-panel--rail'

/** Stacked under workspace (narrow): cap rail height so the page does not sprawl. */
export const companionRailSurfaceStacked: CSSProperties = {
  maxHeight: 'min(720px, 56vh)',
  overflowY: 'auto',
  padding: 16,
}

export type PlanGuideRailLayout = 'stacked' | 'besideWorkspace'

/** Beside workspace on medium/wide: stretch with the grid row; body scrolls inside. */
export function companionRailSurfaceStyle(layout: PlanGuideRailLayout): CSSProperties {
  const padding = 16
  if (layout === 'besideWorkspace') {
    return {
      padding,
      minHeight: 0,
      height: '100%',
      maxHeight: 'none',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }
  }
  return companionRailSurfaceStacked
}
