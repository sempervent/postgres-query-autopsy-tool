import {
  artifactErrorBodyKicker,
  artifactErrorBannerTitle,
  artifactErrorBannerToneClass,
  artifactErrorTone,
} from '../presentation/artifactErrorPresentation'

export function ArtifactErrorBanner(props: { message: string; testId?: string }) {
  const { message, testId } = props
  const tone = artifactErrorTone(message)
  const kicker = artifactErrorBodyKicker(tone)
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
      </div>
    </div>
  )
}
