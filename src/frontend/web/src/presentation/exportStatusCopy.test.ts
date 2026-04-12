import { describe, expect, it } from 'vitest'
import { exportDownloadSuccessHint } from './exportStatusCopy'

describe('exportDownloadSuccessHint', () => {
  it('mentions on-screen match for snapshot exports', () => {
    expect(exportDownloadSuccessHint('snapshot')).toMatch(/on screen|what’s on screen/i)
  })

  it('adds a reopened snapshot clause when opened from a saved link', () => {
    const t = exportDownloadSuccessHint('snapshot', { restoredFromLink: true })
    expect(t).toMatch(/reopened snapshot/i)
    expect(t).toMatch(/saved link/i)
  })

  it('mentions plan text for rebuild exports', () => {
    expect(exportDownloadSuccessHint('fromPlanText')).toMatch(/plan text/i)
  })
})
