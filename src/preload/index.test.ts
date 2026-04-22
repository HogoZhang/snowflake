import { beforeEach, describe, expect, test, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn(async () => undefined)

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld
  },
  ipcRenderer: {
    invoke
  }
}))

describe('preload desktopApi contract', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear()
    invoke.mockClear()
  })

  test('exposes the desktop API and forwards representative IPC calls', async () => {
    vi.resetModules()

    await import('./index')

    expect(exposeInMainWorld).toHaveBeenCalledOnce()
    expect(exposeInMainWorld).toHaveBeenCalledWith('desktopApi', expect.any(Object))

    const desktopApi = exposeInMainWorld.mock.calls[0][1] as Window['desktopApi']

    await desktopApi.getSettings()
    await desktopApi.updateSettings({ activeThemeId: 'mickey' })
    await desktopApi.importSnowflakePackage('merge', true)
    await desktopApi.getAnalyticsSnapshot({ startDate: '2026-04-20', endDate: '2026-04-26' })
    await desktopApi.updateTask('task-1', { status: 'done' })

    expect(invoke).toHaveBeenNthCalledWith(1, 'settings:get')
    expect(invoke).toHaveBeenNthCalledWith(2, 'settings:update', { activeThemeId: 'mickey' })
    expect(invoke).toHaveBeenNthCalledWith(3, 'imports:snowflake', 'merge', true)
    expect(invoke).toHaveBeenNthCalledWith(4, 'analytics:get', {
      startDate: '2026-04-20',
      endDate: '2026-04-26'
    })
    expect(invoke).toHaveBeenNthCalledWith(5, 'tasks:update', 'task-1', { status: 'done' })
  })
})
