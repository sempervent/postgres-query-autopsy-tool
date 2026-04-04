import { mergeAnalyzeWorkspaceLayout, type AnalyzeWorkspaceLayoutState } from './analyzeWorkspaceModel'

export const ANALYZE_WORKSPACE_LOCAL_STORAGE_KEY = 'pqat.analyzeWorkspaceLayout.v1'

export function readAnalyzeWorkspaceLayoutFromLocalStorage(): AnalyzeWorkspaceLayoutState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(ANALYZE_WORKSPACE_LOCAL_STORAGE_KEY)
    if (!raw) return null
    return mergeAnalyzeWorkspaceLayout(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeAnalyzeWorkspaceLayoutToLocalStorage(layout: AnalyzeWorkspaceLayoutState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ANALYZE_WORKSPACE_LOCAL_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* quota / private mode */
  }
}
