import { compareIntroCopy } from '../../presentation/comparePresentation'

export function CompareIntroPanel() {
  const intro = compareIntroCopy()
  return (
    <div className="pqat-panel pqat-panel--capture pqat-panelPad--lg pqat-introBanner pqat-workspaceReveal">
      <div className="pqat-eyebrow">Overview</div>
      <h2 className="pqat-captureTitle">{intro.title}</h2>
      <p className="pqat-hint pqat-hint--tight">{intro.subtitle}</p>
      <div className="pqat-introGrid">
        <div className="pqat-metricTile pqat-metricTile--accentWash">
          <div className="pqat-metricTile__label">What you’ll get</div>
          <ul className="pqat-introList">
            {intro.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <div className="pqat-metricTile">
          <div className="pqat-metricTile__label">Input tips</div>
          <ul className="pqat-introList">
            {intro.inputHints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
