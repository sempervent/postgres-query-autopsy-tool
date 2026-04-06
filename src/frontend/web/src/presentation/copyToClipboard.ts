/**
 * Writes text to the system clipboard. Uses the async Clipboard API when available,
 * then falls back to a hidden textarea + execCommand for non-secure origins (e.g. http LAN)
 * or older browsers where clipboard is undefined.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('No document for clipboard fallback')
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  ta.style.top = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    const ok = document.execCommand('copy')
    if (!ok) {
      throw new Error('execCommand("copy") returned false')
    }
  } finally {
    document.body.removeChild(ta)
  }
}
