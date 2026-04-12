import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { COMPARE_PAIR_INSPECTOR_ANCHOR_ID, SkipToPairInspectorLink } from './SkipToPairInspectorLink'

afterEach(() => cleanup())

test('renders nothing when not visible', () => {
  const { container } = render(<SkipToPairInspectorLink visible={false} />)
  expect(container.firstChild).toBeNull()
})

test('renders compare narrow skip link targeting the pair inspector anchor', () => {
  render(<SkipToPairInspectorLink visible />)
  expect(screen.getByRole('navigation', { name: /compare shortcuts/i })).toBeInTheDocument()
  const link = screen.getByRole('link', { name: /skip to pair inspector/i })
  expect(link).toHaveAttribute('href', `#${COMPARE_PAIR_INSPECTOR_ANCHOR_ID}`)
  expect(link).toHaveAttribute('data-testid', 'compare-skip-to-pair-inspector')
})
