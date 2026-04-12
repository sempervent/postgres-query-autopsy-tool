import { describe, expect, it } from 'vitest'
import { withReopenedSuffix } from './reopenedContinuityCopy'

describe('withReopenedSuffix', () => {
  it('appends a calm en-dash reopened suffix', () => {
    expect(withReopenedSuffix('Summary')).toBe('Summary — reopened')
    expect(withReopenedSuffix('Continues from plan')).toBe('Continues from plan — reopened')
  })
})
