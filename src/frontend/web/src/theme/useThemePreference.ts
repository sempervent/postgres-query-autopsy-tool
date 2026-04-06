import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  APPEARANCE_THEME_PREFERENCE_KEY,
  fetchUserPreference,
  saveUserPreference,
} from '../api/client'
import { hasAuthFetchCredentials } from '../api/authHeaders'
import { applyEffectiveThemeToDocument, applyThemePreferenceAttribute } from './applyThemeToDocument'
import { resolveEffectiveTheme } from './resolveEffectiveTheme'
import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  THEME_STORAGE_KEY,
  type EffectiveTheme,
  type ThemePreference,
} from './themeConstants'

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export type UseThemePreferenceOptions = {
  /** When true and credentials exist, hydrate from / save to `appearance_theme_v1`. */
  serverSyncEnabled?: boolean
}

/**
 * Keeps `<html data-theme>` / `data-effective-theme` / `color-scheme` in sync with preference + OS scheme.
 * Default preference is **system**. Pair with the inline `index.html` boot script to limit FOUC.
 */
export function useThemePreference(options?: UseThemePreferenceOptions): {
  preference: ThemePreference
  effectiveTheme: EffectiveTheme
  setPreference: (p: ThemePreference) => void
} {
  const serverSyncEnabled = options?.serverSyncEnabled ?? false

  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' ? getSystemDark() : false,
  )
  const [serverHydrated, setServerHydrated] = useState(
    () => !serverSyncEnabled || !hasAuthFetchCredentials(),
  )

  const effectiveTheme = useMemo(
    () => resolveEffectiveTheme(preference, systemDark),
    [preference, systemDark],
  )

  useEffect(() => {
    applyThemePreferenceAttribute(preference)
    applyEffectiveThemeToDocument(effectiveTheme)
  }, [preference, effectiveTheme])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSchemeChange = () => {
      setSystemDark(mq.matches)
    }
    setSystemDark(mq.matches)
    mq.addEventListener('change', onSchemeChange)
    return () => mq.removeEventListener('change', onSchemeChange)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return
      const next = isThemePreference(e.newValue) ? e.newValue : DEFAULT_THEME_PREFERENCE
      setPreferenceState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!serverSyncEnabled || !hasAuthFetchCredentials()) {
      setServerHydrated(true)
      return
    }
    let cancelled = false
    setServerHydrated(false)
    ;(async () => {
      try {
        const v = await fetchUserPreference(APPEARANCE_THEME_PREFERENCE_KEY)
        if (cancelled) return
        if (typeof v === 'string' && isThemePreference(v)) {
          try {
            localStorage.setItem(THEME_STORAGE_KEY, v)
          } catch {
            /* ignore */
          }
          setPreferenceState(v)
          applyThemePreferenceAttribute(v)
          applyEffectiveThemeToDocument(resolveEffectiveTheme(v, getSystemDark()))
        }
      } finally {
        if (!cancelled) setServerHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [serverSyncEnabled])

  useEffect(() => {
    if (!serverHydrated || !serverSyncEnabled || !hasAuthFetchCredentials()) return
    const t = window.setTimeout(() => {
      void saveUserPreference(APPEARANCE_THEME_PREFERENCE_KEY, preference)
    }, 500)
    return () => window.clearTimeout(t)
  }, [preference, serverHydrated, serverSyncEnabled])

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p)
    } catch {
      /* ignore */
    }
    setPreferenceState(p)
    applyThemePreferenceAttribute(p)
    applyEffectiveThemeToDocument(resolveEffectiveTheme(p, getSystemDark()))
  }, [])

  return { preference, effectiveTheme, setPreference }
}
