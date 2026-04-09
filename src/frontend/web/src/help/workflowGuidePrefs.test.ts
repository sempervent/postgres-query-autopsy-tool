import { afterEach, describe, expect, it } from 'vitest'
import {
  readWorkflowGuideDismissed,
  urlWantsWorkflowGuide,
  writeWorkflowGuideDismissed,
  WorkflowGuideQueryParam,
} from './workflowGuidePrefs'

describe('workflowGuidePrefs', () => {
  afterEach(() => {
    try {
      window.localStorage.removeItem('pqat_workflow_guide_v1')
    } catch {
      /* ignore */
    }
  })

  it('persists analyze and compare dismissal independently', () => {
    expect(readWorkflowGuideDismissed('analyze')).toBe(false)
    writeWorkflowGuideDismissed('analyze', true)
    expect(readWorkflowGuideDismissed('analyze')).toBe(true)
    expect(readWorkflowGuideDismissed('compare')).toBe(false)
    writeWorkflowGuideDismissed('compare', true)
    expect(readWorkflowGuideDismissed('compare')).toBe(true)
    writeWorkflowGuideDismissed('analyze', false)
    expect(readWorkflowGuideDismissed('analyze')).toBe(false)
    expect(readWorkflowGuideDismissed('compare')).toBe(true)
  })

  it('urlWantsWorkflowGuide accepts 1 and true', () => {
    expect(urlWantsWorkflowGuide(new URLSearchParams())).toBe(false)
    const a = new URLSearchParams()
    a.set(WorkflowGuideQueryParam, '1')
    expect(urlWantsWorkflowGuide(a)).toBe(true)
    const b = new URLSearchParams()
    b.set(WorkflowGuideQueryParam, 'TRUE')
    expect(urlWantsWorkflowGuide(b)).toBe(true)
  })
})
