import type { EffectiveTheme, ThemePreference } from './themeConstants'

/**
 * Applies resolved theme to `<html>` for CSS `html[data-theme="…"]` and `color-scheme`.
 * Visual-regression runs may set `data-visual-regression` separately.
 */
export function applyEffectiveThemeToDocument(effective: EffectiveTheme): void {
  const el = document.documentElement
  el.setAttribute('data-theme', effective)
  /** Stable hook for tests / debugging — mirrors `data-theme` (resolved skin, not preference). */
  el.setAttribute('data-effective-theme', effective)
  el.style.colorScheme = effective
}

export function applyThemePreferenceAttribute(preference: ThemePreference): void {
  document.documentElement.setAttribute('data-theme-preference', preference)
}
