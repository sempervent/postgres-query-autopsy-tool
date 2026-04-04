import '@testing-library/jest-dom/vitest'

/** Preload lazy customizer chunks so `React.lazy` + Suspense resolve immediately in jsdom (avoids stuck fallbacks). */
import '../components/compare/CompareWorkspaceCustomizerInner'
import '../components/analyze/AnalyzeWorkspaceCustomizerInner'

/** Graph stack + lower-band panels + selected-node heavy sections — keep tests deterministic without timing waits. */
import '../components/AnalyzePlanGraphCore'
import '../components/analyze/AnalyzeFindingsPanel'
import '../components/analyze/AnalyzeSelectedNodePanel'
import '../components/analyze/AnalyzeSelectedNodeHeavySections'
import '../components/compare/CompareSelectedPairHeavySections'

/** Some Node/Vitest localStorage shims expose a broken object without `getItem`. */
;(function ensureLocalStorage() {
  const ls = globalThis.localStorage as Storage | undefined
  if (ls && typeof ls.getItem === 'function') return
  const map = new Map<string, string>()
  const fake: Storage = {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    key(index: number) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, String(value))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fake, writable: true, configurable: true })
})()

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

