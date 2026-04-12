import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

/** Message queued when `?guide=` opens the panel from a closed state (Analyze / Compare announcers). */
export const GUIDE_OPENED_FROM_LINK_MESSAGE = 'Guided help opened from link.'

/**
 * Open the workflow guide when the URL requests it (`?guide=1` / `true`).
 * Call from **`useLayoutEffect`** so the first browser paint matches the open state (avoids a one-frame closed flash)
 * while preserving the false→open transition that drives the announcer + focus refs.
 */
export function openWorkflowGuideWhenUrlRequests(args: {
  urlWantsGuide: boolean
  setGuideOpen: Dispatch<SetStateAction<boolean>>
  pendingFocusTitleRef: MutableRefObject<boolean>
  pendingOpenAnnRef: MutableRefObject<string | null>
  setKeyboardContain: Dispatch<SetStateAction<boolean>>
}): void {
  if (!args.urlWantsGuide) return
  let becameOpen = false
  args.setGuideOpen((wasOpen) => {
    if (!wasOpen) {
      becameOpen = true
      args.pendingFocusTitleRef.current = true
      args.pendingOpenAnnRef.current = GUIDE_OPENED_FROM_LINK_MESSAGE
    }
    return true
  })
  if (becameOpen) queueMicrotask(() => args.setKeyboardContain(true))
}
