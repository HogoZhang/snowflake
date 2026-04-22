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
    ipcRenderer.invoke('tasks:checklist:remove', taskId, checklistItemId)
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
