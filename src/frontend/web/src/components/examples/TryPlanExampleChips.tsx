import type { AnalyzePlanExample, AnalyzePlanExampleId } from '../../examples/analyzePlanExamples'
import type { ComparePlanExample, ComparePlanExampleId } from '../../examples/comparePlanExamples'

export function TryAnalyzeExampleChips(props: {
  examples: readonly AnalyzePlanExample[]
  onSelect: (id: AnalyzePlanExampleId) => void
  disabled?: boolean
  /** 'capture' = under input; 'help' = inside workflow guide */
  variant?: 'capture' | 'help'
}) {
  const { examples, onSelect, disabled, variant = 'capture' } = props
  const wrapClass = variant === 'help' ? 'pqat-help-exampleChips' : 'pqat-tryExampleChips'
  const suffix = variant === 'help' ? '-help' : '-capture'

  return (
    <div className={wrapClass} role="group" aria-label="Sample plan shortcuts">
      {examples.map((ex) => (
        <button
          key={ex.id}
          type="button"
          className="pqat-btn pqat-btn--sm pqat-btn--ghost pqat-tryExampleChips__btn"
          data-testid={`analyze-try-example-${ex.id}${suffix}`}
          title={ex.blurb}
          disabled={disabled}
          onClick={() => onSelect(ex.id)}
        >
          {ex.label}
        </button>
      ))}
    </div>
  )
}

export function TryCompareExampleChips(props: {
  examples: readonly ComparePlanExample[]
  onSelect: (id: ComparePlanExampleId) => void
  disabled?: boolean
  variant?: 'capture' | 'help'
}) {
  const { examples, onSelect, disabled, variant = 'capture' } = props
  const wrapClass = variant === 'help' ? 'pqat-help-exampleChips' : 'pqat-tryExampleChips'
  const suffix = variant === 'help' ? '-help' : '-capture'

  return (
    <div className={wrapClass} role="group" aria-label="Try a sample comparison">
      {examples.map((ex) => (
        <button
          key={ex.id}
          type="button"
          className="pqat-btn pqat-btn--sm pqat-btn--ghost pqat-tryExampleChips__btn"
          data-testid={`compare-try-example-${ex.id}${suffix}`}
          title={ex.blurb}
          disabled={disabled}
          onClick={() => onSelect(ex.id)}
        >
          {ex.label}
        </button>
      ))}
    </div>
  )
}
