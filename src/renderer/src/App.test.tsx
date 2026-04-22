import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { App } from './App'
import {
  defaultAnalyticsSnapshot,
  defaultSettings,
  installDesktopApiMock
} from './test/desktopApiMock'
import { renderWithRouter } from './test/renderWithRouter'

describe('App integration', () => {
  test('loads persisted settings on the settings page and reflects the active theme', async () => {
    const desktopApi = installDesktopApiMock({
      getSettings: vi.fn(async () => ({
        ...defaultSettings(),
        activeThemeId: 'mickey'
      } as const))
    })

    renderWithRouter(<App />, { initialEntries: ['/settings'] })

    expect(await screen.findByRole('heading', { name: /Appearance, persistence and live preview/i })).toBeInTheDocument()
    expect(await screen.findByText('当前主题：米老鼠')).toBeInTheDocument()
    expect(screen.getByText('主题 ID：mickey')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('mickey')
    expect(desktopApi.getStorageSnapshot).toHaveBeenCalled()
  })

  test('navigates to analytics and requests the analytics snapshot', async () => {
    const desktopApi = installDesktopApiMock({
      getAnalyticsSnapshot: vi.fn(async () => defaultAnalyticsSnapshot())
    })
    const user = userEvent.setup()

    renderWithRouter(<App />, { initialEntries: ['/settings'] })

    await screen.findByRole('heading', { name: /Appearance, persistence and live preview/i })
    await user.click(screen.getByRole('link', { name: '统计图表' }))

    expect(await screen.findByRole('heading', { name: '统计图表' })).toBeInTheDocument()
    await waitFor(() => {
      expect(desktopApi.getAnalyticsSnapshot).toHaveBeenCalled()
    })
  })

  test('saves a newly selected theme through desktopApi.updateSettings', async () => {
    const desktopApi = installDesktopApiMock()
    const user = userEvent.setup()

    renderWithRouter(<App />, { initialEntries: ['/settings'] })

    await screen.findByRole('heading', { name: /Appearance, persistence and live preview/i })
    await user.click(screen.getByRole('button', { name: /米老鼠/ }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => {
      expect(desktopApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          activeThemeId: 'mickey'
        })
      )
    })

    expect(await screen.findByText('Settings saved locally.')).toBeInTheDocument()
  })

  test('shows transfer feedback for manual exports', async () => {
    const desktopApi = installDesktopApiMock()
    const user = userEvent.setup()

    renderWithRouter(<App />, { initialEntries: ['/settings'] })

    await screen.findByRole('heading', { name: /Appearance, persistence and live preview/i })
    await user.click(screen.getByRole('button', { name: '导出 .snowflake' }))

    expect(await screen.findByText(/Package exported to D:\/projects\/snowflake\/test-data\/export\.snowflake/)).toBeInTheDocument()
    expect(desktopApi.exportSnowflakePackage).toHaveBeenCalledOnce()
  })

  test('renders an error banner when initial app state loading fails', async () => {
    installDesktopApiMock({
      getSettings: vi.fn(async () => {
        throw new Error('Failed to load settings.')
      })
    })

    renderWithRouter(<App />, { initialEntries: ['/settings'] })

    expect(await screen.findByText('Failed to load settings.')).toBeInTheDocument()
  })
})
