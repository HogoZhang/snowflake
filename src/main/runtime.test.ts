import { describe, expect, test, vi } from 'vitest'

import { createDialogSelectors, registerIpcHandlers, type AppServices, type IpcMainGateway } from './runtime'

function createServiceStubs(): AppServices {
  return {
    storage: {
      getSettings: vi.fn(async () => ({ activeThemeId: 'default' })),
      updateSettings: vi.fn(async (patch) => patch),
      getSnapshot: vi.fn(async () => ({ dataDirectory: 'D:/data', availableDocuments: [], schemaVersion: 1 }))
    },
    taskService: {
      getTaskDocument: vi.fn(async () => ({ tasks: [] })),
      createTask: vi.fn(async () => ({ tasks: [] })),
      updateTask: vi.fn(async () => ({ tasks: [] })),
      removeTask: vi.fn(async () => ({ tasks: [] })),
      addChecklistItem: vi.fn(async () => ({ tasks: [] })),
      toggleChecklistItem: vi.fn(async () => ({ tasks: [] })),
      removeChecklistItem: vi.fn(async () => ({ tasks: [] }))
    },
    journalService: {
      getJournalDocument: vi.fn(async () => ({ entries: [] })),
      upsertJournalEntry: vi.fn(async () => ({ entries: [] })),
      deleteJournalEntry: vi.fn(async () => ({ entries: [] })),
      restoreJournalEntry: vi.fn(async () => ({ entries: [] })),
      getCompletedTaskReferencesByDate: vi.fn(async () => [])
    },
    analyticsService: {
      getSnapshot: vi.fn(async () => ({ completedTaskCount: 0 }))
    },
    importExportService: {
      exportSnowflakePackage: vi.fn(async (filePath: string) => ({ filePath, format: 'snowflake' })),
      exportJsonSnapshot: vi.fn(async (filePath: string) => ({ filePath, format: 'json' })),
      createBackupSnapshot: vi.fn(async () => ({ filePath: 'backup.snowflake' })),
      importSnowflakePackage: vi.fn(async (filePath: string, mode: string, includeSettings: boolean) => ({
        filePath,
        mode,
        includeSettings
      }))
    }
  } as unknown as AppServices
}

function createIpcMainHarness(): {
  ipcMain: IpcMainGateway
  handlers: Map<string, (event: never, ...args: any[]) => unknown | Promise<unknown>>
} {
  const handlers = new Map<string, (event: never, ...args: any[]) => unknown | Promise<unknown>>()

  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel, listener) => {
        handlers.set(channel, listener as (event: never, ...args: any[]) => unknown | Promise<unknown>)
      })
    }
  }
}

describe('runtime dialogs', () => {
  test('picks a save path from the documents directory', async () => {
    const selectors = createDialogSelectors(
      {
        showSaveDialog: vi.fn(async () => ({
          canceled: false,
          filePath: 'D:/exports/archive.snowflake'
        })),
        showOpenDialog: vi.fn(async () => ({
          canceled: false,
          filePaths: ['D:/imports/archive.snowflake']
        }))
      },
      {
        getPath: vi.fn((name) => (name === 'documents' ? 'D:/docs' : 'D:/user')),
        getVersion: vi.fn(() => '0.1.0')
      }
    )

    await expect(
      selectors.pickSavePath([{ name: 'Snowflake Package', extensions: ['snowflake'] }], 'snapshot.snowflake')
    ).resolves.toBe('D:/exports/archive.snowflake')
  })

  test('rejects canceled import selection', async () => {
    const selectors = createDialogSelectors(
      {
        showSaveDialog: vi.fn(async () => ({
          canceled: false,
          filePath: 'D:/exports/archive.snowflake'
        })),
        showOpenDialog: vi.fn(async () => ({
          canceled: true,
          filePaths: []
        }))
      },
      {
        getPath: vi.fn(() => 'D:/docs'),
        getVersion: vi.fn(() => '0.1.0')
      }
    )

    await expect(selectors.pickOpenPath()).rejects.toThrow('Import canceled.')
  })
})

describe('registerIpcHandlers', () => {
  test('registers the main IPC contract and forwards export/import requests', async () => {
    const services = createServiceStubs()
    const dialogs = {
      pickSavePath: vi.fn(async () => 'D:/exports/snowflake.snowflake'),
      pickOpenPath: vi.fn(async () => 'D:/imports/snowflake.snowflake')
    }
    const { ipcMain, handlers } = createIpcMainHarness()

    registerIpcHandlers(ipcMain, services, dialogs)

    expect([...handlers.keys()]).toEqual(
      expect.arrayContaining([
        'app:ping',
        'settings:get',
        'settings:update',
        'storage:snapshot',
        'exports:snowflake',
        'imports:snowflake',
        'analytics:get',
        'tasks:update',
        'journals:upsert'
      ])
    )

    await expect(handlers.get('app:ping')?.(undefined as never)).resolves.toBe('pong')
    await expect(handlers.get('exports:snowflake')?.(undefined as never)).resolves.toMatchObject({
      filePath: 'D:/exports/snowflake.snowflake',
      format: 'snowflake'
    })
    await expect(
      handlers.get('imports:snowflake')?.(undefined as never, 'merge', true)
    ).resolves.toMatchObject({
      filePath: 'D:/imports/snowflake.snowflake',
      mode: 'merge',
      includeSettings: true
    })

    expect(dialogs.pickSavePath).toHaveBeenCalledOnce()
    expect(services.importExportService.exportSnowflakePackage).toHaveBeenCalledWith(
      'D:/exports/snowflake.snowflake'
    )
    expect(dialogs.pickOpenPath).toHaveBeenCalledOnce()
    expect(services.importExportService.importSnowflakePackage).toHaveBeenCalledWith(
      'D:/imports/snowflake.snowflake',
      'merge',
      true
    )
  })
})
