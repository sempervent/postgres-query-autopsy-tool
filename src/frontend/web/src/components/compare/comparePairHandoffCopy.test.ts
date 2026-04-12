import { describe, expect, it } from 'vitest'
import { comparePairHandoffDisplayText } from './comparePairHandoffCopy'

describe('comparePairHandoffDisplayText', () => {
  it('uses link-aware copy for pinned and navigator', () => {
    expect(comparePairHandoffDisplayText('pinned', 'link')).toBe('Pinned — reopened')
    expect(comparePairHandoffDisplayText('pinned', 'session')).toBe('Pinned focus')
    expect(comparePairHandoffDisplayText('navigator', 'link')).toBe('From the lists — reopened')
    expect(comparePairHandoffDisplayText('navigator', 'session')).toBe('From the lists')
  })

  it('marks summary and briefing as reopened when the comparison came from a saved link', () => {
    expect(comparePairHandoffDisplayText('summary', 'link')).toBe('Summary — reopened')
    expect(comparePairHandoffDisplayText('summary', 'session')).toBe('From the summary')
    expect(comparePairHandoffDisplayText('briefing', 'link')).toBe('Briefing — reopened')
    expect(comparePairHandoffDisplayText('briefing', 'session')).toBe('From the briefing')
  })
})
