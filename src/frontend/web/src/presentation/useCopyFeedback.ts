import { useCallback, useEffect, useRef, useState } from 'react'
import { copyToClipboard } from './copyToClipboard'

/** Long enough for screen readers to pick up success politely without feeling sticky. */
export const COPY_FEEDBACK_SUCCESS_CLEAR_MS = 2200

/**
 * Brief defer before Compare pin `aria-live` transitions so a just-fired copy success line
 * can finish first (same polite region timing family as copy feedback).
 */
export const PIN_LIVE_ANNOUNCE_DEFER_MS = 120

export function useCopyFeedback() {
  const [status, setStatus] = useState<string | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (clearTimerRef.current != null) {
        globalThis.clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
    }
  }, [])

  const copy = useCallback(async (text: string, okMessage = 'Copied') => {
    if (clearTimerRef.current != null) {
      globalThis.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
    try {
      await copyToClipboard(text)
      if (!mountedRef.current) return
      setStatus(okMessage)
      clearTimerRef.current = globalThis.setTimeout(() => {
        clearTimerRef.current = null
        if (mountedRef.current) setStatus(null)
      }, COPY_FEEDBACK_SUCCESS_CLEAR_MS)
    } catch {
      if (!mountedRef.current) return
      setStatus(
        'Copy failed — try again from the button (clipboard needs a direct click), use HTTPS/localhost, or select text manually',
      )
      clearTimerRef.current = globalThis.setTimeout(() => {
        clearTimerRef.current = null
        if (mountedRef.current) setStatus(null)
      }, 5200)
    }
  }, [])

  return { status, copy }
}

