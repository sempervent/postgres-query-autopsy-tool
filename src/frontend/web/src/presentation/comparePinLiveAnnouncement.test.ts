import { describe, expect, it } from 'vitest'
import {
  COMPARE_PIN_HYDRATE_CLEAR_MS,
  comparePinAnnouncementForFingerprint,
  comparePinHydrateAnnouncementForFingerprint,
  comparePinLiveFingerprint,
} from './comparePinLiveAnnouncement'

describe('comparePinLiveFingerprint', () => {
  it('prefers finding, then index, then suggestion', () => {
    expect(comparePinLiveFingerprint('fd_1', 'ii_2', 'sg_3')).toBe('f:fd_1')
    expect(comparePinLiveFingerprint(null, 'ii_2', 'sg_3')).toBe('i:ii_2')
    expect(comparePinLiveFingerprint(null, null, 'sg_3')).toBe('s:sg_3')
    expect(comparePinLiveFingerprint(null, null, null)).toBe('none')
  })
})

describe('comparePinAnnouncementForFingerprint', () => {
  it('maps fingerprints to concise copy', () => {
    expect(comparePinAnnouncementForFingerprint('none')).toMatch(/cleared/i)
    expect(comparePinAnnouncementForFingerprint('f:x')).toMatch(/finding/i)
    expect(comparePinAnnouncementForFingerprint('i:x')).toMatch(/index insight/i)
    expect(comparePinAnnouncementForFingerprint('s:x')).toMatch(/next step/i)
  })
})

describe('COMPARE_PIN_HYDRATE_CLEAR_MS', () => {
  it('is a bounded auto-clear window for hydrate-only live copy', () => {
    expect(COMPARE_PIN_HYDRATE_CLEAR_MS).toBeGreaterThanOrEqual(3000)
    expect(COMPARE_PIN_HYDRATE_CLEAR_MS).toBeLessThanOrEqual(8000)
  })
})

describe('comparePinHydrateAnnouncementForFingerprint', () => {
  it('uses distinct “Opened with” copy only when a pin is present', () => {
    expect(comparePinHydrateAnnouncementForFingerprint('none')).toBe('')
    expect(comparePinHydrateAnnouncementForFingerprint('f:x')).toMatch(/opened with.*finding/i)
    expect(comparePinHydrateAnnouncementForFingerprint('i:x')).toMatch(/opened with.*index insight/i)
    expect(comparePinHydrateAnnouncementForFingerprint('s:x')).toMatch(/opened with.*next step/i)
  })
})
