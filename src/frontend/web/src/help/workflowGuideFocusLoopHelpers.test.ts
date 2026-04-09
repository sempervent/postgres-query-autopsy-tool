import { expect, test, vi } from 'vitest'
import { collectWorkflowGuideFocusables, workflowGuideFocusLoopKeydownHandler } from './workflowGuideFocusLoopHelpers'

test('collectWorkflowGuideFocusables returns h2 with tabindex 0 and buttons in order', () => {
  document.body.innerHTML = `
    <section id="shell">
      <h2 id="t" tabindex="0">Title</h2>
      <button type="button" id="b1">One</button>
      <button type="button" id="b2" disabled>Off</button>
      <button type="button" id="b3">Three</button>
    </section>
  `
  const shell = document.getElementById('shell') as HTMLElement
  const list = collectWorkflowGuideFocusables(shell)
  expect(list.map((el) => el.id)).toEqual(['t', 'b1', 'b3'])
})

test('workflowGuideFocusLoopKeydownHandler wraps Tab forward from last focusable', () => {
  document.body.innerHTML = `
    <section id="shell">
      <h2 id="t" tabindex="0">Title</h2>
      <button type="button" id="b1">One</button>
    </section>
  `
  const shell = document.getElementById('shell') as HTMLElement
  const b1 = document.getElementById('b1') as HTMLButtonElement
  b1.focus()
  const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  const spy = vi.spyOn(e, 'preventDefault')
  workflowGuideFocusLoopKeydownHandler(shell, e)
  expect(spy).toHaveBeenCalled()
  expect(document.activeElement?.id).toBe('t')
})

test('workflowGuideFocusLoopKeydownHandler wraps Shift+Tab backward from first focusable', () => {
  document.body.innerHTML = `
    <section id="shell">
      <h2 id="t" tabindex="0">Title</h2>
      <button type="button" id="b1">One</button>
    </section>
  `
  const shell = document.getElementById('shell') as HTMLElement
  const t = document.getElementById('t') as HTMLHeadingElement
  t.focus()
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
  const spy = vi.spyOn(e, 'preventDefault')
  workflowGuideFocusLoopKeydownHandler(shell, e)
  expect(spy).toHaveBeenCalled()
  expect(document.activeElement?.id).toBe('b1')
})
