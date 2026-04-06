/** Absolute URL for a same-origin pathname (e.g. `/analyze/…`) — used by copy-link actions. */
export function appUrlForPath(path: string): string {
  return `${window.location.origin}${path}`
}
