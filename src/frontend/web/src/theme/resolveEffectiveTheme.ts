import type { EffectiveTheme, ThemePreference } from './themeConstants'

/** Resolve stored preference + optional `prefers-color-scheme: dark` match. */
export function resolveEffectiveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): EffectiveTheme {
  if (preference === 'dark') return 'dark'
  if (preference === 'light') return 'light'
  return prefersDark ? 'dark' : 'light'
}
