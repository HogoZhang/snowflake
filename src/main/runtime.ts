import { join } from 'node:path'

import type { IpcMainInvokeEvent } from 'electron'

import { AnalyticsService } from './analytics/analyticsService'
import { ImportExportService } from './importExport/importExportService'
import { JournalService } from './journal/journalService'
import { FileStorage } from './storage/fileStorage'
import { TaskService } from './tasks/taskService'

type SaveDialogFilter = {
  name: string
  extensions: string[]
}

type SaveDialogResult = {
  canceled: boolean
  filePath?: string
}

type OpenDialogResult = {
  canceled: boolean
  filePaths: string[]
}

type OpenDialogProperty =
  | 'openFile'
  | 'openDirectory'
  | 'multiSelections'
  | 'showHiddenFiles'
  | 'createDirectory'
  | 'promptToCreate'
  | 'noResolveAliases'
  | 'treatPackageAsDirectory'
  | 'dontAddToRecent'

export interface AppPathGateway {
  getPath: (name: 'documents' | 'userData') => string
  getVersion: () => string
}

export interface DialogGateway {
  showSaveDialog: (options: { defaultPath: string; filters: SaveDialogFilter[] }) => Promise<SaveDialogResult>
  showOpenDialog: (options: { filters: SaveDialogFilter[]; properties: OpenDialogProperty[] }) => Promise<OpenDialogResult>
}

export interface IpcMainGateway {
  handle: (
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown | Promise<unknown>
  ) => void
}

export interface AppServices {
  storage: FileStorage
  taskService: TaskService
  journalService: JournalService
  analyticsService: AnalyticsService
  importExportService: ImportExportService
}

export interface DialogSelectors {
  pickSavePath: (filters: SaveDialogFilter[], defaultName: string) => Promise<string>
  pickOpenPath: () => Promise<string>
}

export function createApplicationServices(userDataDirectory: string, appVersion: string): AppServices {
  const storage = new FileStorage(userDataDirectory)

  return {
    storage,
    taskService: new TaskService(storage),
    journalService: new JournalService(storage),
    analyticsService: new AnalyticsService(storage),
    importExportService: new ImportExportService(storage, appVersion)
  }
}

export function createDialogSelectors(dialog: DialogGateway, app: AppPathGateway): DialogSelectors {
  return {
    pickSavePath: async (filters, defaultName) => {
      const result = await dialog.showSaveDialog({
        defaultPath: join(app.getPath('documents'), defaultName),
        filters
      })

      if (result.canceled || !result.filePath) {
        throw new Error('Export canceled.')
      }

      return result.filePath
    },
    pickOpenPath: async () => {
      const result = await dialog.showOpenDialog({
        filters: [{ name: 'Snowflake Package', extensions: ['snowflake'] }],
        properties: ['openFile']
      })

      const selected = result.filePaths[0]
      if (result.canceled || !selected) {
        throw new Error('Import canceled.')
      }

      return selected
    }
  }
}

export function registerIpcHandlers(
  ipcMain: IpcMainGateway,
  services: AppServices,
  dialogs: DialogSelectors
): void {
  ipcMain.handle('app:ping', async () => 'pong')
  ipcMain.handle('settings:get', async () => services.storage.getSettings())
  ipcMain.handle('settings:update', async (_event, nextSettings) => services.storage.updateSettings(nextSettings))
  ipcMain.handle('storage:snapshot', async () => services.storage.getSnapshot())
  ipcMain.handle('exports:snowflake', async () => {
    const filePath = await dialogs.pickSavePath(
      [{ name: 'Snowflake Package', extensions: ['snowflake'] }],
      `snowflake-export-${new Date().toISOString().slice(0, 10)}.snowflake`
    )
    return services.importExportService.exportSnowflakePackage(filePath)
  })
  ipcMain.handle('exports:json', async () => {
    const filePath = await dialogs.pickSavePath(
      [{ name: 'JSON Snapshot', extensions: ['json'] }],
      `snowflake-export-${new Date().toISOString().slice(0, 10)}.json`
    )
    return services.importExportService.exportJsonSnapshot(filePath)
  })
  ipcMain.handle('backups:create', async () => services.importExportService.createBackupSnapshot())
  ipcMain.handle('imports:snowflake', async (_event, mode, includeSettings) => {
    const filePath = await dialogs.pickOpenPath()
    return services.importExportService.importSnowflakePackage(filePath, mode, includeSettings)
  })
  ipcMain.handle('analytics:get', async (_event, input) => services.analyticsService.getSnapshot(input))
  ipcMain.handle('tasks:get', async () => services.taskService.getTaskDocument())
  ipcMain.handle('journals:get', async () => services.journalService.getJournalDocument())
  ipcMain.handle('journals:upsert', async (_event, input) => services.journalService.upsertJournalEntry(input))
  ipcMain.handle('journals:delete', async (_event, entryId) => services.journalService.deleteJournalEntry(entryId))
  ipcMain.handle('journals:restore', async (_event, entryId) => services.journalService.restoreJournalEntry(entryId))
  ipcMain.handle('journals:tasks:completed-by-date', async (_event, date) =>
    services.journalService.getCompletedTaskReferencesByDate(date)
  )
  ipcMain.handle('tasks:create', async (_event, input) => services.taskService.createTask(input))
  ipcMain.handle('tasks:update', async (_event, taskId, input) => services.taskService.updateTask(taskId, input))
  ipcMain.handle('tasks:remove', async (_event, taskId) => services.taskService.removeTask(taskId))
  ipcMain.handle('tasks:checklist:add', async (_event, taskId, input) =>
    services.taskService.addChecklistItem(taskId, input)
  )
  ipcMain.handle('tasks:checklist:toggle', async (_event, taskId, checklistItemId) =>
    services.taskService.toggleChecklistItem(taskId, checklistItemId)
  )
  ipcMain.handle('tasks:checklist:remove', async (_event, taskId, checklistItemId) =>
    services.taskService.removeChecklistItem(taskId, checklistItemId)
  )
}
