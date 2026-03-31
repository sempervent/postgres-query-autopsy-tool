import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import AnalyzePage from './pages/AnalyzePage'
import ComparePage from './pages/ComparePage'

export default function App() {
  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandTitle">Postgres Query Autopsy Tool</div>
        </div>
        <nav className="nav">
          <Link className="navLink" to="/">
            Analyze
          </Link>
          <Link className="navLink" to="/compare">
            Compare
          </Link>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<AnalyzePage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </main>
    </div>
  )
}
