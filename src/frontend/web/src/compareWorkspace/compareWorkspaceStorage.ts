import { mergeCompareWorkspaceLayout, type CompareWorkspaceLayoutState } from './compareWorkspaceModel'

export const COMPARE_WORKSPACE_LOCAL_STORAGE_KEY = 'pqat.compareWorkspaceLayout.v1'

export function readCompareWorkspaceLayoutFromLocalStorage(): CompareWorkspaceLayoutState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(COMPARE_WORKSPACE_LOCAL_STORAGE_KEY)
    if (!raw) return null
    return mergeCompareWorkspaceLayout(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeCompareWorkspaceLayoutToLocalStorage(layout: CompareWorkspaceLayoutState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COMPARE_WORKSPACE_LOCAL_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* quota */
  }
}
