import { useEffect, useState } from 'react'

/** Wide Analyze workspace breakpoint (~1080px). Safe when `matchMedia` is missing (tests). */
export function useAnalyzeWorkspaceWide() {
  const [wide, setWide] = useState(() => {
    if (typeof globalThis === 'undefined') return true
    const mm = globalThis.matchMedia
    if (typeof mm !== 'function') return true
    try {
      return mm.call(globalThis, '(min-width: 1080px)').matches
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (typeof globalThis === 'undefined' || typeof globalThis.matchMedia !== 'function') return
    let mq: MediaQueryList
    try {
      mq = globalThis.matchMedia('(min-width: 1080px)')
    } catch {
      return
    }
    const fn = () => setWide(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return wide
}
