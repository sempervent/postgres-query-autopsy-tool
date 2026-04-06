import type { EffectiveTheme, ThemePreference } from '../theme/themeConstants'
import { effectiveThemeLabel, themePreferenceAriaDescription } from '../theme/themePresentation'

const options: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

type Props = {
  preference: ThemePreference
  effectiveTheme: EffectiveTheme
  onChange: (p: ThemePreference) => void
}

/** Top-bar appearance control (Phase 65–66). */
export function ThemeAppearanceSelect({ preference, effectiveTheme, onChange }: Props) {
  const ariaDesc = themePreferenceAriaDescription(preference, effectiveTheme)
  return (
    <div className="pqat-themeSelect">
      <label className="pqat-themeSelect__labelRow" htmlFor="pqat-theme-appearance">
        <span className="pqat-themeSelect__label">Appearance</span>
        {preference === 'system' ? (
          <span className="pqat-themeSelect__effective" title="Resolved from your system light/dark mode">
            → {effectiveThemeLabel(effectiveTheme)}
          </span>
        ) : null}
      </label>
      {ariaDesc ? (
        <span id="pqat-theme-appearance-desc" className="pqat-srOnly">
          {ariaDesc}
        </span>
      ) : null}
      <select
        id="pqat-theme-appearance"
        className="pqat-themeSelect__input"
        aria-label="Theme appearance"
        aria-describedby={ariaDesc ? 'pqat-theme-appearance-desc' : undefined}
        data-testid="theme-appearance-select"
        value={preference}
        onChange={(e) => onChange(e.target.value as ThemePreference)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
