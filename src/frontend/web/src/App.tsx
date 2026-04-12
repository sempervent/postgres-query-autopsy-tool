import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import './workstation.css'
import './workstation-patterns.css'
import './help/helpSurface.css'
import { fetchAppConfig } from './api/client'
import { ThemeAppearanceSelect } from './components/ThemeAppearanceSelect'
import { RouteFallback } from './components/RouteFallback'
import { useStickyTopOffsetSync } from './hooks/useStickyTopOffsetSync'
import { useThemePreference } from './theme/useThemePreference'

const AnalyzePage = lazy(() => import('./pages/AnalyzePage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))

export default function App() {
  const [themeServerSync, setThemeServerSync] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchAppConfig()
      .then((c) => {
        if (!cancelled) setThemeServerSync(c.authEnabled)
      })
      .catch(() => {
        if (!cancelled) setThemeServerSync(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { preference, effectiveTheme, setPreference } = useThemePreference({
    serverSyncEnabled: themeServerSync,
  })

  useStickyTopOffsetSync(true)

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandTitle">Postgres Query Autopsy Tool</div>
          <div className="brandTagline" aria-hidden="true">
            Plan forensics · operator workspace
          </div>
        </div>
        <div className="topBar__end">
          <nav className="nav">
            <NavLink className={({ isActive }) => `navLink${isActive ? ' navLink--active' : ''}`} to="/" end>
              Analyze
            </NavLink>
            <NavLink className={({ isActive }) => `navLink${isActive ? ' navLink--active' : ''}`} to="/compare">
              Compare
            </NavLink>
          </nav>
          <ThemeAppearanceSelect
            preference={preference}
            effectiveTheme={effectiveTheme}
            onChange={setPreference}
          />
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<RouteFallback label="Loading Analyze…" />}>
                <AnalyzePage />
              </Suspense>
            }
          />
          <Route
            path="/compare"
            element={
              <Suspense fallback={<RouteFallback label="Loading Compare…" />}>
                <ComparePage />
              </Suspense>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
