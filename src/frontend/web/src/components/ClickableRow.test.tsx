import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ClickableRow } from './ClickableRow'

describe('ClickableRow', () => {
  it('calls onPointerIntent on mouse enter and focus (prefetch / warm paths)', () => {
    const intent = vi.fn()
    const activate = vi.fn()
    render(
      <ClickableRow onActivate={activate} onPointerIntent={intent} aria-label="test row">
        content
      </ClickableRow>,
    )
    const row = screen.getByRole('button', { name: 'test row' })
    fireEvent.mouseEnter(row)
    fireEvent.focus(row)
    expect(intent).toHaveBeenCalledTimes(2)
  })
})
