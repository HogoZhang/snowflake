import type { PropsWithChildren, ReactElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

export function renderWithRouter(
  ui: ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {}
): RenderResult {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>)
}

export function TestRouterProvider({
  children,
  initialEntries = ['/']
}: PropsWithChildren<{ initialEntries?: string[] }>): ReactElement {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
}
