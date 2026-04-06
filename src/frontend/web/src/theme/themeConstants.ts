/** localStorage key — keep in sync with inline script in `index.html`. */
export const THEME_STORAGE_KEY = 'pqat_theme_v1'

export type ThemePreference = 'system' | 'dark' | 'light'

export type EffectiveTheme = 'dark' | 'light'

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

export function isThemePreference(v: string | null): v is ThemePreference {
  return v === 'system' || v === 'dark' || v === 'light'
}
