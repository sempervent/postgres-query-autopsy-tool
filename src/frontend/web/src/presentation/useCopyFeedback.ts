import { useCallback, useState } from 'react'

export function useCopyFeedback() {
  const [status, setStatus] = useState<string | null>(null)

  const copy = useCallback(async (text: string, okMessage = 'Copied') => {
    await navigator.clipboard.writeText(text)
    setStatus(okMessage)
    window.setTimeout(() => setStatus(null), 1200)
  }, [])

  return { status, copy }
}

