import { useCallback, useEffect, useRef, useState } from 'react'
import { copyToClipboard } from './copyToClipboard'

/** Long enough for screen readers to pick up success politely without feeling sticky. */
const COPY_SUCCESS_CLEAR_MS = 2200

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
      }, COPY_SUCCESS_CLEAR_MS)
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

