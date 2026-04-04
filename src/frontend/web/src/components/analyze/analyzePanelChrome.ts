import type { CSSProperties } from 'react'

/** Plan guide rail: class + scroll bounds (layout-specific). */
export const planGuideRailClassName = 'pqat-panel pqat-panel--rail'

export const companionRailSurface: CSSProperties = {
  maxHeight: 'min(720px, 56vh)',
  overflowY: 'auto',
  padding: 16,
}
