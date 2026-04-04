import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import './workstation.css'
import './workstation-patterns.css'
import { RouteFallback } from './components/RouteFallback'

const AnalyzePage = lazy(() => import('./pages/AnalyzePage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))

export default function App() {
  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandTitle">Postgres Query Autopsy Tool</div>
          <div className="brandTagline" aria-hidden="true">
            Plan forensics · operator workspace
          </div>
        </div>
        <nav className="nav">
          <NavLink className={({ isActive }) => `navLink${isActive ? ' navLink--active' : ''}`} to="/" end>
            Analyze
          </NavLink>
          <NavLink className={({ isActive }) => `navLink${isActive ? ' navLink--active' : ''}`} to="/compare">
            Compare
          </NavLink>
        </nav>
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
