import type { CSSProperties } from 'react'

export const companionRailSurface: CSSProperties = {
  maxHeight: 'min(720px, 56vh)',
  overflowY: 'auto',
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'color-mix(in srgb, var(--bg) 93%, var(--accent-bg))',
}
