import { contextBridge, ipcRenderer } from 'electron'

import type {
  AnalyticsQueryInput,
  AnalyticsSnapshot,
  AppSettings,
  CreateChecklistItemInput,
  CreateTaskInput,
  DesktopApi,
  ExportResult,
  ImportMode,
  ImportResult,
  JournalTaskReference,
  LogFilter,
  NotificationOptions,
  NotificationResult,
  ShortcutAction,
  ShortcutDefinition,
  StorageSnapshot,
  UpsertJournalEntryInput,
  UpdateTaskInput
} from '@shared/schema'

const desktopApi: DesktopApi = {
  ping: async () => ipcRenderer.invoke('app:ping'),
  getSettings: async () => ipcRenderer.invoke('settings:get'),
  updateSettings: async (nextSettings: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:update', nextSettings),
  getStorageSnapshot: async (): Promise<StorageSnapshot> => ipcRenderer.invoke('storage:snapshot'),
  exportSnowflakePackage: async (): Promise<ExportResult> => ipcRenderer.invoke('exports:snowflake'),
  exportJsonSnapshot: async (): Promise<ExportResult> => ipcRenderer.invoke('exports:json'),
  createBackupSnapshot: async (): Promise<ExportResult> => ipcRenderer.invoke('backups:create'),
  importSnowflakePackage: async (mode: ImportMode, includeSettings: boolean): Promise<ImportResult> =>
    ipcRenderer.invoke('imports:snowflake', mode, includeSettings),
  getAnalyticsSnapshot: async (input: AnalyticsQueryInput): Promise<AnalyticsSnapshot> =>
    ipcRenderer.invoke('analytics:get', input),
  getTaskDocument: async () => ipcRenderer.invoke('tasks:get'),
  getJournalDocument: async () => ipcRenderer.invoke('journals:get'),
  upsertJournalEntry: async (input: UpsertJournalEntryInput) => ipcRenderer.invoke('journals:upsert', input),
  deleteJournalEntry: async (entryId: string) => ipcRenderer.invoke('journals:delete', entryId),
  restoreJournalEntry: async (entryId: string) => ipcRenderer.invoke('journals:restore', entryId),
  getCompletedTaskReferencesByDate: async (date: string): Promise<JournalTaskReference[]> =>
    ipcRenderer.invoke('journals:tasks:completed-by-date', date),
  createTask: async (input: CreateTaskInput) => ipcRenderer.invoke('tasks:create', input),
  updateTask: async (taskId: string, input: UpdateTaskInput) =>
    ipcRenderer.invoke('tasks:update', taskId, input),
  removeTask: async (taskId: string) => ipcRenderer.invoke('tasks:remove', taskId),
  addChecklistItem: async (taskId: string, input: CreateChecklistItemInput) =>
    ipcRenderer.invoke('tasks:checklist:add', taskId, input),
  toggleChecklistItem: async (taskId: string, checklistItemId: string) =>
    ipcRenderer.invoke('tasks:checklist:toggle', taskId, checklistItemId),
  removeChecklistItem: async (taskId: string, checklistItemId: string) =>
    ipcRenderer.invoke('tasks:checklist:remove', taskId, checklistItemId),

  showNotification: async (options: NotificationOptions): Promise<NotificationResult> =>
    ipcRenderer.invoke('notification:show', options),

  getShortcuts: async (): Promise<ShortcutDefinition[]> => ipcRenderer.invoke('shortcuts:get'),
  updateShortcut: async (action: ShortcutAction, enabled: boolean): Promise<ShortcutDefinition[]> =>
    ipcRenderer.invoke('shortcuts:update', action, enabled),

  logDebug: async (module: string, message: string, data?: Record<string, unknown>) =>
    ipcRenderer.invoke('log:debug', module, message, data),
  logInfo: async (module: string, message: string, data?: Record<string, unknown>) =>
    ipcRenderer.invoke('log:info', module, message, data),
  logWarn: async (module: string, message: string, data?: Record<string, unknown>) =>
    ipcRenderer.invoke('log:warn', module, message, data),
  logError: async (module: string, message: string, data?: Record<string, unknown>) =>
    ipcRenderer.invoke('log:error', module, message, data),
  getLogs: async (filter?: LogFilter) => ipcRenderer.invoke('log:get', filter)
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
