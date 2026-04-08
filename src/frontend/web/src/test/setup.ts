import '@testing-library/jest-dom/vitest'
import { beforeAll } from 'vitest'

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

/** Invokes the callback like a browser so React Flow updates width/height and node dimensions from `getDimensions`. */
class ResizeObserverStub {
  private cb: ResizeObserverCallback

  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }

  observe(target: Element) {
    const fire = () => {
      const el = target as HTMLElement
      const w = el.offsetWidth || (el.getAttribute?.('data-id') ? 260 : 1024)
      const h = el.offsetHeight || (el.getAttribute?.('data-id') ? 74 : 768)
      const entry = {
        target,
        contentRect: {
          x: 0,
          y: 0,
          width: w,
          height: h,
          top: 0,
          left: 0,
          bottom: h,
          right: w,
          toJSON() {
            return {}
          },
        },
        borderBoxSize: [] as readonly ResizeObserverSize[],
        contentBoxSize: [] as readonly ResizeObserverSize[],
        devicePixelContentBoxSize: [] as readonly ResizeObserverSize[],
      } as ResizeObserverEntry
      try {
        this.cb([entry], this as unknown as ResizeObserver)
      } catch {
        /* ignore: RF may observe before full mount */
      }
    }
    fire()
    queueMicrotask(fire)
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

/**
 * React Flow measures nodes via offsetWidth/offsetHeight and @xyflow/background uses viewport zoom.
 * jsdom reports 0×0, so node dimensions never update → NaN SVG coords and noisy Vitest stderr.
 * Only inflate metrics inside `.react-flow` so the rest of the DOM stays unchanged.
 */
;(function patchReactFlowLayoutMetricsForJsdom() {
  const proto = globalThis.HTMLElement?.prototype
  if (!proto) return
  const dW = Object.getOwnPropertyDescriptor(proto, 'offsetWidth')
  const dH = Object.getOwnPropertyDescriptor(proto, 'offsetHeight')
  if (!dW?.get || !dH?.get) return
  const origW = dW.get
  const origH = dH.get
  Object.defineProperty(proto, 'offsetWidth', {
    configurable: true,
    enumerable: dW.enumerable,
    get(this: HTMLElement) {
      const base = origW.call(this)
      if (base > 0) return base
      if (!this.closest?.('.react-flow')) return base
      if (this.getAttribute?.('data-id') || this.classList.contains('react-flow__node')) return 260
      return 1024
    },
  })
  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    enumerable: dH.enumerable,
    get(this: HTMLElement) {
      const base = origH.call(this)
      if (base > 0) return base
      if (!this.closest?.('.react-flow')) return base
      if (this.getAttribute?.('data-id') || this.classList.contains('react-flow__node')) return 74
      return 768
    },
  })
})()

/** jsdom in some Vitest/Node stacks omits `document.execCommand`; copy uses it synchronously first (Phase 84). */
beforeAll(() => {
  const d = globalThis.document
  if (!d || typeof d.execCommand === 'function') return
  Object.defineProperty(d, 'execCommand', {
    configurable: true,
    writable: true,
    value: () => false,
  })
})

