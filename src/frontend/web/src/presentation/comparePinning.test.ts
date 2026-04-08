import { describe, expect, it } from 'vitest'
import { nextRovingOrdinal } from './comparePinning'

describe('comparePinning', () => {
  it('nextRovingOrdinal clamps at ends without wrapping', () => {
    expect(nextRovingOrdinal(0, -1, 3)).toBe(0)
    expect(nextRovingOrdinal(0, 1, 3)).toBe(1)
    expect(nextRovingOrdinal(2, 1, 3)).toBe(2)
    expect(nextRovingOrdinal(1, -2, 3)).toBe(0)
    expect(nextRovingOrdinal(0, 0, 0)).toBe(0)
  })
})
