import { useCallback, useState } from 'react'
import { copyToClipboard } from './copyToClipboard'

export function useCopyFeedback() {
  const [status, setStatus] = useState<string | null>(null)

  const copy = useCallback(async (text: string, okMessage = 'Copied') => {
    try {
      await copyToClipboard(text)
      setStatus(okMessage)
      window.setTimeout(() => setStatus(null), 1600)
    } catch {
      setStatus('Copy failed — select text manually or check browser permissions')
      window.setTimeout(() => setStatus(null), 4200)
    }
  }, [])

  return { status, copy }
}

