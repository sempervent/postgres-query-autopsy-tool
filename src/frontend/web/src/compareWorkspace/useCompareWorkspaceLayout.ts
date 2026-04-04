import { useCallback, useEffect, useState } from 'react'
import { COMPARE_WORKSPACE_PREFERENCE_KEY, fetchUserPreference, saveUserPreference } from '../api/client'
import { hasAuthFetchCredentials } from '../api/authHeaders'
import {
  applyCompareWorkspacePreset,
  coerceCompareLeftStackOrder,
  coerceCompareSummarySectionOrder,
  defaultCompareWorkspaceLayout,
  mergeCompareWorkspaceLayout,
  type CompareLeftStackId,
  type CompareMainColumnId,
  type CompareSummarySectionId,
  type CompareWorkspaceLayoutState,
  type CompareWorkspacePresetId,
  type CompareWorkspaceRegionId,
} from './compareWorkspaceModel'
import { readCompareWorkspaceLayoutFromLocalStorage, writeCompareWorkspaceLayoutToLocalStorage } from './compareWorkspaceStorage'
import { swapWithNeighbor } from '../workspaceLayout/reorder'

export type CompareWorkspaceLayoutApi = {
  layout: CompareWorkspaceLayoutState
  setVisibility: (id: CompareWorkspaceRegionId, visible: boolean) => void
  setPreset: (p: CompareWorkspacePresetId) => void
  resetToDefaults: () => void
  moveSummarySection: (index: number, direction: -1 | 1) => void
  moveLeftStack: (index: number, direction: -1 | 1) => void
  setSummarySectionOrder: (next: CompareSummarySectionId[]) => void
  setLeftStackOrder: (next: CompareLeftStackId[]) => void
  swapMainColumns: () => void
  serverHydrated: boolean
}

export function useCompareWorkspaceLayout(authEnabled: boolean): CompareWorkspaceLayoutApi {
  const [layout, setLayout] = useState<CompareWorkspaceLayoutState>(() => {
    const local = readCompareWorkspaceLayoutFromLocalStorage()
    return local ?? defaultCompareWorkspaceLayout()
  })
  const [serverHydrated, setServerHydrated] = useState(() => !authEnabled || !hasAuthFetchCredentials())

  useEffect(() => {
    writeCompareWorkspaceLayoutToLocalStorage(layout)
  }, [layout])

  useEffect(() => {
    if (!authEnabled || !hasAuthFetchCredentials()) {
      setServerHydrated(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const v = await fetchUserPreference(COMPARE_WORKSPACE_PREFERENCE_KEY)
        if (cancelled) return
        if (v != null) setLayout(mergeCompareWorkspaceLayout(v))
      } finally {
        if (!cancelled) setServerHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authEnabled])

  useEffect(() => {
    if (!serverHydrated || !authEnabled || !hasAuthFetchCredentials()) return
    const t = window.setTimeout(() => {
      void saveUserPreference(COMPARE_WORKSPACE_PREFERENCE_KEY, layout)
    }, 600)
    return () => window.clearTimeout(t)
  }, [layout, serverHydrated, authEnabled])

  const setVisibility = useCallback((id: CompareWorkspaceRegionId, visible: boolean) => {
    setLayout((prev) => ({
      ...prev,
      preset: null,
      visibility: { ...prev.visibility, [id]: visible },
    }))
  }, [])

  const setPreset = useCallback((p: CompareWorkspacePresetId) => {
    setLayout(applyCompareWorkspacePreset(p))
  }, [])

  const resetToDefaults = useCallback(() => {
    setLayout(defaultCompareWorkspaceLayout())
  }, [])

  const moveSummarySection = useCallback((index: number, direction: -1 | 1) => {
    setLayout((prev) => ({
      ...prev,
      preset: null,
      summarySectionOrder: swapWithNeighbor(prev.summarySectionOrder, index, direction),
    }))
  }, [])

  const moveLeftStack = useCallback((index: number, direction: -1 | 1) => {
    setLayout((prev) => ({
      ...prev,
      preset: null,
      leftStackOrder: swapWithNeighbor(prev.leftStackOrder, index, direction),
    }))
  }, [])

  const swapMainColumns = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      preset: null,
      mainColumnOrder: [prev.mainColumnOrder[1], prev.mainColumnOrder[0]] as [CompareMainColumnId, CompareMainColumnId],
    }))
  }, [])

  const setSummarySectionOrder = useCallback((next: CompareSummarySectionId[]) => {
    const valid = coerceCompareSummarySectionOrder(next)
    if (!valid) return
    setLayout((prev) => ({ ...prev, preset: null, summarySectionOrder: valid }))
  }, [])

  const setLeftStackOrder = useCallback((next: CompareLeftStackId[]) => {
    const valid = coerceCompareLeftStackOrder(next)
    if (!valid) return
    setLayout((prev) => ({ ...prev, preset: null, leftStackOrder: valid }))
  }, [])

  return {
    layout,
    setVisibility,
    setPreset,
    resetToDefaults,
    moveSummarySection,
    moveLeftStack,
    setSummarySectionOrder,
    setLeftStackOrder,
    swapMainColumns,
    serverHydrated,
  }
}
