import { describe, expect, test, vi } from 'vitest'

import { createMainWindow, getMainWindowOptions, type BrowserWindowFactory, type BrowserWindowInstance } from './window'

describe('main window options', () => {
  test('uses hiddenInset title bar only on macOS', () => {
    expect(getMainWindowOptions('D:/preload/index.mjs', 'darwin').titleBarStyle).toBe('hiddenInset')
    expect(getMainWindowOptions('D:/preload/index.mjs', 'win32').titleBarStyle).toBeUndefined()
  })
})

describe('createMainWindow', () => {
  test('loads the dev server URL when available', async () => {
    const storage = {
      ensureReady: vi.fn(async () => undefined)
    }
    const browserWindow = {
      loadURL: vi.fn(async () => undefined),
      loadFile: vi.fn(async () => undefined),
      webContents: {
        setWindowOpenHandler: vi.fn()
      }
    } satisfies BrowserWindowInstance

    const BrowserWindow = vi.fn(() => browserWindow) as unknown as BrowserWindowFactory

    await createMainWindow({
      BrowserWindow,
      storage: storage as never,
      env: { ELECTRON_RENDERER_URL: 'http://localhost:5173' },
      baseDir: 'D:/projects/snowflake/out/main',
      platform: 'win32'
    })

    expect(storage.ensureReady).toHaveBeenCalledOnce()
    expect(browserWindow.loadURL).toHaveBeenCalledWith('http://localhost:5173')
    expect(browserWindow.loadFile).not.toHaveBeenCalled()
    expect(browserWindow.webContents.setWindowOpenHandler).toHaveBeenCalledOnce()
  })

  test('loads the packaged renderer file outside dev mode', async () => {
    const browserWindow = {
      loadURL: vi.fn(async () => undefined),
      loadFile: vi.fn(async () => undefined),
      webContents: {
        setWindowOpenHandler: vi.fn()
      }
    } satisfies BrowserWindowInstance

    const BrowserWindow = vi.fn(() => browserWindow) as unknown as BrowserWindowFactory

    await createMainWindow({
      BrowserWindow,
      storage: { ensureReady: vi.fn(async () => undefined) } as never,
      env: {},
      baseDir: 'D:/projects/snowflake/out/main',
      platform: 'win32'
    })

    expect(browserWindow.loadFile).toHaveBeenCalledWith(
      expect.stringMatching(/out[\\/]+renderer[\\/]+index\.html$/)
    )
  })
})
