import { useWorkspaceLayoutTier } from './useWorkspaceLayoutTier'

/**
 * True when graph+guide can sit side-by-side (medium or wide tier).
 * Prefer `useWorkspaceLayoutTier()` when you need distinct tablet vs desktop behavior.
 */
export function useAnalyzeWorkspaceWide(): boolean {
  const tier = useWorkspaceLayoutTier()
  return tier !== 'narrow'
}

export { useWorkspaceLayoutTier } from './useWorkspaceLayoutTier'
