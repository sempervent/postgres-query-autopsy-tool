/** Query param: open workflow guide (Analyze or Compare). Support / onboarding deep-link. */
export const WorkflowGuideQueryParam = 'guide' as const

const STORAGE_KEY = 'pqat_workflow_guide_v1'

export type WorkflowGuideSurface = 'analyze' | 'compare'

type Stored = {
  v: 1
  /** User hid the guide on an empty Analyze page; reopen via button, ?guide=1, or ?. */
  analyzeDismissed?: boolean
  /** User hid the guide on an empty Compare page (in addition to workspace intro). */
  compareDismissed?: boolean
}

function readRaw(): Stored {
  if (typeof window === 'undefined') return { v: 1 }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { v: 1 }
    const o = JSON.parse(raw) as Partial<Stored>
    if (o?.v !== 1) return { v: 1 }
    return { v: 1, analyzeDismissed: o.analyzeDismissed, compareDismissed: o.compareDismissed }
  } catch {
    return { v: 1 }
  }
}

function writeRaw(s: Stored) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* quota / private mode */
  }
}

export function readWorkflowGuideDismissed(surface: WorkflowGuideSurface): boolean {
  const s = readRaw()
  return surface === 'analyze' ? Boolean(s.analyzeDismissed) : Boolean(s.compareDismissed)
}

export function writeWorkflowGuideDismissed(surface: WorkflowGuideSurface, dismissed: boolean) {
  const cur = readRaw()
  if (surface === 'analyze') cur.analyzeDismissed = dismissed
  else cur.compareDismissed = dismissed
  writeRaw(cur)
}

/** `?guide=1` or `?guide=true` (case-insensitive). */
export function urlWantsWorkflowGuide(searchParams: URLSearchParams): boolean {
  const g = searchParams.get(WorkflowGuideQueryParam)?.trim().toLowerCase()
  return g === '1' || g === 'true'
}

/** Initial open on Analyze when empty (dismissal only). `?guide=` is applied in a `useEffect` so MemoryRouter tests stay correct. */
export function readAnalyzeGuideInitialOpen(): boolean {
  return !readWorkflowGuideDismissed('analyze')
}
