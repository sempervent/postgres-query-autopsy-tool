import { useCallback, useEffect, useState } from 'react'
import {
  ANALYZE_WORKSPACE_PREFERENCE_KEY,
  fetchUserPreference,
  saveUserPreference,
} from '../api/client'
import { hasAuthFetchCredentials } from '../api/authHeaders'
import {
  applyAnalyzeWorkspacePreset,
  coerceAnalyzeGuideSectionOrder,
  coerceAnalyzeLowerBandOrder,
  defaultAnalyzeWorkspaceLayout,
  mergeAnalyzeWorkspaceLayout,
  type AnalyzeGuideSectionId,
  type AnalyzeLowerBandColumnId,
  type AnalyzeWorkspaceLayoutState,
  type AnalyzeWorkspacePresetId,
  type AnalyzeWorkspaceRegionId,
} from './analyzeWorkspaceModel'
import { writeAnalyzeWorkspaceLayoutToLocalStorage, readAnalyzeWorkspaceLayoutFromLocalStorage } from './analyzeWorkspaceStorage'
import { swapWithNeighbor } from '../workspaceLayout/reorder'

export type AnalyzeWorkspaceLayoutApi = {
  layout: AnalyzeWorkspaceLayoutState
  setVisibility: (id: AnalyzeWorkspaceRegionId, visible: boolean) => void
  setPreset: (p: AnalyzeWorkspacePresetId) => void
  resetToDefaults: () => void
  moveLowerBand: (index: number, direction: -1 | 1) => void
  moveGuideSection: (index: number, direction: -1 | 1) => void
  setGuideSectionOrder: (next: AnalyzeGuideSectionId[]) => void
  setLowerBandOrder: (next: AnalyzeLowerBandColumnId[]) => void
  /** True after optional server hydrate finishes (or immediately when no server sync). */
  serverHydrated: boolean
}

export function useAnalyzeWorkspaceLayout(authEnabled: boolean): AnalyzeWorkspaceLayoutApi {
  const [layout, setLayout] = useState<AnalyzeWorkspaceLayoutState>(() => {
    const local = readAnalyzeWorkspaceLayoutFromLocalStorage()
    return local ?? defaultAnalyzeWorkspaceLayout()
  })
  const [serverHydrated, setServerHydrated] = useState(() => !authEnabled || !hasAuthFetchCredentials())

  useEffect(() => {
    writeAnalyzeWorkspaceLayoutToLocalStorage(layout)
  }, [layout])

  useEffect(() => {
    if (!authEnabled || !hasAuthFetchCredentials()) {
      setServerHydrated(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const v = await fetchUserPreference(ANALYZE_WORKSPACE_PREFERENCE_KEY)
        if (cancelled) return
        if (v != null) setLayout(mergeAnalyzeWorkspaceLayout(v))
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
      void saveUserPreference(ANALYZE_WORKSPACE_PREFERENCE_KEY, layout)
    }, 600)
    return () => window.clearTimeout(t)
  }, [layout, serverHydrated, authEnabled])

  const setVisibility = useCallback((id: AnalyzeWorkspaceRegionId, visible: boolean) => {
    setLayout((prev) => ({
      ...prev,
      preset: null,
      visibility: { ...prev.visibility, [id]: visible },
    }))
  }, [])

  const setPreset = useCallback((p: AnalyzeWorkspacePresetId) => {
    setLayout(applyAnalyzeWorkspacePreset(p))
  }, [])

  const resetToDefaults = useCallback(() => {
    setLayout(defaultAnalyzeWorkspaceLayout())
  }, [])

  const moveLowerBand = useCallback((index: number, direction: -1 | 1) => {
    setLayout((prev) => ({
      ...prev,
      preset: null,
      lowerBandOrder: swapWithNeighbor(prev.lowerBandOrder, index, direction),
    }))
  }, [])

  const moveGuideSection = useCallback((index: number, direction: -1 | 1) => {
    setLayout((prev) => ({
      ...prev,
      preset: null,
      guideSectionOrder: swapWithNeighbor(prev.guideSectionOrder, index, direction),
    }))
  }, [])

  const setGuideSectionOrder = useCallback((next: AnalyzeGuideSectionId[]) => {
    const valid = coerceAnalyzeGuideSectionOrder(next)
    if (!valid) return
    setLayout((prev) => ({ ...prev, preset: null, guideSectionOrder: valid }))
  }, [])

  const setLowerBandOrder = useCallback((next: AnalyzeLowerBandColumnId[]) => {
    const valid = coerceAnalyzeLowerBandOrder(next)
    if (!valid) return
    setLayout((prev) => ({ ...prev, preset: null, lowerBandOrder: valid }))
  }, [])

  return {
    layout,
    setVisibility,
    setPreset,
    resetToDefaults,
    moveLowerBand,
    moveGuideSection,
    setGuideSectionOrder,
    setLowerBandOrder,
    serverHydrated,
  }
}
