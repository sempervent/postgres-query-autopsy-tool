import type { EffectiveTheme, ThemePreference } from './themeConstants'

/** Short label for the resolved skin (shown when preference is System). */
export function effectiveThemeLabel(t: EffectiveTheme): string {
  return t === 'dark' ? 'Dark' : 'Light'
}

/** Screen-reader hint: clarifies that System follows the OS. */
export function themePreferenceAriaDescription(
  preference: ThemePreference,
  effective: EffectiveTheme,
): string | undefined {
  if (preference === 'system') {
    return `Following system appearance (${effectiveThemeLabel(effective)}).`
  }
  return undefined
}
