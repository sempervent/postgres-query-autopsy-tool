import type { Dispatch, SetStateAction } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { GUIDE_OPENED_FROM_LINK_MESSAGE, openWorkflowGuideWhenUrlRequests } from './workflowGuideOpenFromUrl'

function mockSetState(initial: boolean): { readonly state: boolean; setGuideOpen: Dispatch<SetStateAction<boolean>> } {
  let state = initial
  const setGuideOpen: Dispatch<SetStateAction<boolean>> = (u) => {
    state = typeof u === 'function' ? (u as (prev: boolean) => boolean)(state) : u
  }
  return {
    get state() {
      return state
    },
    setGuideOpen,
  }
}

describe('openWorkflowGuideWhenUrlRequests', () => {
  it('does nothing when url does not want guide', () => {
    const setGuideOpen = vi.fn()
    const pendingFocus = { current: false }
    const pendingAnn = { current: null as string | null }
    const setKb = vi.fn()
    openWorkflowGuideWhenUrlRequests({
      urlWantsGuide: false,
      setGuideOpen,
      pendingFocusTitleRef: pendingFocus,
      pendingOpenAnnRef: pendingAnn,
      setKeyboardContain: setKb,
    })
    expect(setGuideOpen).not.toHaveBeenCalled()
  })

  it('opens from closed, sets focus + ann ref, schedules keyboard contain', async () => {
    const guide = mockSetState(false)
    const pendingFocus = { current: false }
    const pendingAnn = { current: null as string | null }
    const setKb = vi.fn()
    openWorkflowGuideWhenUrlRequests({
      urlWantsGuide: true,
      setGuideOpen: guide.setGuideOpen,
      pendingFocusTitleRef: pendingFocus,
      pendingOpenAnnRef: pendingAnn,
      setKeyboardContain: setKb,
    })
    expect(guide.state).toBe(true)
    expect(pendingFocus.current).toBe(true)
    expect(pendingAnn.current).toBe(GUIDE_OPENED_FROM_LINK_MESSAGE)
    await Promise.resolve()
    expect(setKb).toHaveBeenCalledWith(true)
  })

  it('does not duplicate ann when already open', async () => {
    const guide = mockSetState(true)
    const pendingFocus = { current: false }
    const pendingAnn = { current: null as string | null }
    const setKb = vi.fn()
    openWorkflowGuideWhenUrlRequests({
      urlWantsGuide: true,
      setGuideOpen: guide.setGuideOpen,
      pendingFocusTitleRef: pendingFocus,
      pendingOpenAnnRef: pendingAnn,
      setKeyboardContain: setKb,
    })
    expect(guide.state).toBe(true)
    expect(pendingAnn.current).toBeNull()
    expect(pendingFocus.current).toBe(false)
    await Promise.resolve()
    expect(setKb).not.toHaveBeenCalled()
  })
})
