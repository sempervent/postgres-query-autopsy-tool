/**
 * Whether a **`regionContinuitySummaryCue`** is concrete enough to show the pair panel
 * **Reading thread** fallback (Phase 113) without repeating vague summary chips.
 *
 * Phase 136: rules are explicit and table-tested so engine wording ↔ UI gating stays traceable.
 */

/** Golden / regression vectors — keep in sync with `compareContinuityCueSpecificity.test.ts`. */
export const COMPARE_CONTINUITY_CUE_CLASSIFICATION_FIXTURES: readonly {
  cue: string
  specific: boolean
  note: string
}[] = [
  { cue: 'ok', specific: false, note: 'vague token' },
  { cue: 'mixed', specific: false, note: 'vague token' },
  { cue: 'vague', specific: false, note: 'non-actionable short' },
  { cue: 'x'.repeat(45), specific: true, note: 'length floor' },
  {
    cue: 'Seq scan on public.users replaced by index-backed access on Plan B',
    specific: true,
    note: 'structural scan/index vocabulary',
  },
  {
    cue: 'Plan A seq scan worsened latency vs Plan B index',
    specific: true,
    note: 'short outcome + plan vocabulary',
  },
  {
    cue: 'Plan B index scan faster than Plan A seq scan at root',
    specific: true,
    note: 'faster/slower + plan + scan',
  },
  {
    cue: 'Same region · join strategy shift',
    specific: true,
    note: 'join-shape one-liner (NL↔hash)',
  },
  {
    cue: 'Sequential scan on orders replaced by index scan on Plan B',
    specific: true,
    note: 'Reading thread body sample',
  },
]

export function compareContinuityCueIsSpecific(cue: string): boolean {
  const t = cue.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (t.length >= 42) return true
  const lower = t.toLowerCase()

  if (/^(ok|mixed|unclear|varies|unknown|n\/a|none|maybe|some)$/i.test(t)) return false

  // Scan / index / join / ordering vocabulary — usual engine shorthand.
  if (/→|index|bitmap|seq|scan|nested|hash join|gather|sort|ordering|relation/i.test(lower)) return true

  // Join-shape one-liners (e.g. nested loop ↔ hash join) without repeating "scan".
  if (/\b(strategy shift|join strategy)\b/i.test(lower)) return true

  if (
    t.length >= 28 &&
    /\b(worsened|improved|replaced|regression|before|after|plan\s*[ab])\b/i.test(lower)
  ) {
    return true
  }
  if (
    t.length >= 24 &&
    /\b(slower|faster|better|worse|shifted|replaced)\b/i.test(lower) &&
    /\b(plan\s*[ab]|root|join|scan)\b/i.test(lower)
  ) {
    return true
  }
  return false
}
