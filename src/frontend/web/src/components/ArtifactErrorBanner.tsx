import {
  artifactErrorBodyKicker,
  artifactErrorBannerNextStep,
  artifactErrorBannerTitle,
  artifactErrorBannerToneClass,
  artifactErrorTone,
} from '../presentation/artifactErrorPresentation'

export function ArtifactErrorBanner(props: { message: string; testId?: string }) {
  const { message, testId } = props
  const tone = artifactErrorTone(message)
  const kicker = artifactErrorBodyKicker(tone)
  const next = artifactErrorBannerNextStep(message)
  return (
    <div
      className={`pqat-stateBanner pqat-artifactErrorBanner ${artifactErrorBannerToneClass(tone)}`}
      role="alert"
      data-testid={testId}
    >
      <span className="pqat-stateBanner__title">{artifactErrorBannerTitle(message)}</span>
      <div className="pqat-stateBanner__body pqat-artifactErrorBanner__body">
        <span className="pqat-artifactErrorBanner__kicker">{kicker}</span>
        <span className="pqat-artifactErrorBanner__message">{message}</span>
        {next ? (
          <div className="pqat-artifactErrorBanner__next" style={{ marginTop: 8, fontSize: 13, opacity: 0.92 }}>
            {next}
          </div>
        ) : null}
      </div>
    </div>
  )
}
