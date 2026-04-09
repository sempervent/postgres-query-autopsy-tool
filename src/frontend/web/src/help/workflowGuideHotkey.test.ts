import { describe, expect, it } from 'vitest'
import { isWorkflowGuideHotkey, workflowGuideHotkeyShouldIgnoreTarget } from './workflowGuideHotkey'

describe('workflowGuideHotkey', () => {
  it('ignores inputs and contenteditable', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    expect(workflowGuideHotkeyShouldIgnoreTarget(input)).toBe(true)
    input.remove()
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    expect(workflowGuideHotkeyShouldIgnoreTarget(ta)).toBe(true)
    ta.remove()
    const sel = document.createElement('select')
    document.body.appendChild(sel)
    expect(workflowGuideHotkeyShouldIgnoreTarget(sel)).toBe(true)
    sel.remove()
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    expect(workflowGuideHotkeyShouldIgnoreTarget(div)).toBe(true)
    div.remove()
    const p = document.createElement('p')
    document.body.appendChild(p)
    expect(workflowGuideHotkeyShouldIgnoreTarget(p)).toBe(false)
    p.remove()
  })

  it('detects ? and Shift+/ without modifiers', () => {
    const body = document.body
    function mk(p: { key: string; shiftKey?: boolean; ctrlKey?: boolean; code?: string; target?: EventTarget }): KeyboardEvent {
      const ev = new KeyboardEvent('keydown', {
        key: p.key,
        shiftKey: p.shiftKey,
        ctrlKey: p.ctrlKey,
        code: p.code,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(ev, 'target', { value: p.target ?? body, enumerable: true })
      return ev
    }

    expect(isWorkflowGuideHotkey(mk({ key: '?', target: body }))).toBe(true)
    expect(isWorkflowGuideHotkey(mk({ key: '/', shiftKey: true, code: 'Slash', target: body }))).toBe(true)
    expect(isWorkflowGuideHotkey(mk({ key: '/', shiftKey: false, target: body }))).toBe(false)
    expect(isWorkflowGuideHotkey(mk({ key: '?', ctrlKey: true, target: body }))).toBe(false)
    const ta = document.createElement('textarea')
    expect(isWorkflowGuideHotkey(mk({ key: '?', target: ta }))).toBe(false)
  })
})
