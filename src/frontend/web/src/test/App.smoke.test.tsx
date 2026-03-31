import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

test('renders analyze page', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  expect(screen.getByText('Input plan')).toBeInTheDocument()
})

test('analyze page does not leak raw root.* ids by default', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  // With no analysis loaded, UI should not show internal ids.
  expect(screen.queryByText(/root\.\d+/)).toBeNull()
})

