import { WorkflowGuideQueryParam } from './workflowGuidePrefs'

/** Absolute URL that opens the same route with only `?guide=1` (support / onboarding handoff). */
export function buildWorkflowGuideAbsoluteUrl(pathname: string): string {
  const path = pathname && pathname.startsWith('/') ? pathname : '/'
  if (typeof window === 'undefined') {
    return `${path}?${WorkflowGuideQueryParam}=1`
  }
  const u = new URL(path, window.location.origin)
  u.search = ''
  u.searchParams.set(WorkflowGuideQueryParam, '1')
  return u.toString()
}

/**
 * Copy guided link: current path + merged query (`guide=1` set/replaced) + hash.
 * Keeps deep-link params (e.g. `comparison=`, `analysis=`) so support can share “this view + guide”.
 */
export function buildCopyGuidedLinkUrlFromLocation(loc: Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>): string {
  const path = loc.pathname && loc.pathname.startsWith('/') ? loc.pathname : '/'
  const u = new URL(path + (loc.search || ''), loc.origin)
  u.searchParams.set(WorkflowGuideQueryParam, '1')
  let out = u.toString()
  if (loc.hash) out += loc.hash
  return out
}
