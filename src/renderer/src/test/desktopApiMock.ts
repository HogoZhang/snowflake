import { vi } from 'vitest'

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
  JournalDocument,
  JournalTaskReference,
  LogEntry,
  LogFilter,
  NotificationOptions,
  NotificationResult,
  ShortcutAction,
  ShortcutDefinition,
  StorageSnapshot,
  TaskDocument,
  UpsertJournalEntryInput,
  UpdateTaskInput
} from '@shared/schema'

export const defaultSettings = (): AppSettings => ({
  version: 1,
  activeThemeId: 'default',
  storagePath: 'D:/projects/snowflake/test-data',
  autoSaveIntervalMs: 500,
  locale: 'zh-CN',
  useSystemTitleBar: false,
  updatedAt: '2026-04-22T00:00:00.000Z'
})

export const defaultSnapshot = (): StorageSnapshot => ({
  dataDirectory: 'D:/projects/snowflake/test-data',
  availableDocuments: ['tasks', 'journals', 'settings'],
  schemaVersion: 1
})

export const defaultTaskDocument = (): TaskDocument => ({
  version: 1,
  tasks: [],
  categories: [
    { id: 'work', name: '工作', color: '#ff6b6b', icon: 'briefcase', isDefault: true },
    { id: 'reading', name: '阅读', color: '#ffd93d', icon: 'book-open', isDefault: true }
  ],
  timeLogs: []
})

export const defaultJournalDocument = (): JournalDocument => ({
  version: 1,
  entries: [],
  templates: [
    {
      id: 'daily-template',
      name: '日报模板',
      type: 'daily',
      templateContent: '今日完成\n- ',
      isDefault: true
    }
  ]
})

export const defaultAnalyticsSnapshot = (): AnalyticsSnapshot => ({
  range: {
    startDate: '2026-04-20',
    endDate: '2026-04-26'
  },
  completedTaskCount: 0,
  totalFocusMinutes: 0,
  totalJournalEntries: 0,
  topCategory: null,
  dailySummaries: [],
  categoryStats: [],
  efficiencyRecords: [],
  heatmapPoints: [],
  taskDetails: [],
  journalDetails: []
})

export const defaultShortcuts = (): ShortcutDefinition[] => [
  { action: 'new_task', accelerator: 'CmdOrCtrl+N', enabled: true },
  { action: 'toggle_timer', accelerator: 'CmdOrCtrl+T', enabled: true },
  { action: 'complete_task', accelerator: 'CmdOrCtrl+Enter', enabled: true },
  { action: 'open_tasks', accelerator: 'CmdOrCtrl+1', enabled: true },
  { action: 'open_journal', accelerator: 'CmdOrCtrl+2', enabled: true },
  { action: 'open_analytics', accelerator: 'CmdOrCtrl+3', enabled: true },
  { action: 'open_settings', accelerator: 'CmdOrCtrl+,', enabled: true },
  { action: 'search', accelerator: 'CmdOrCtrl+F', enabled: true }
]

export const defaultLogs = (): LogEntry[] => []

export function createDesktopApiMock(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const exportResult: ExportResult = {
    format: 'snowflake',
    filePath: 'D:/projects/snowflake/test-data/export.snowflake',
    byteLength: 128,
    exportedAt: '2026-04-22T00:00:00.000Z'
  }

  const importResult: ImportResult = {
    filePath: 'D:/projects/snowflake/test-data/import.snowflake',
    mode: 'merge',
    importedDocuments: ['tasks', 'journals'],
    backupPath: 'D:/projects/snowflake/test-data/backup.snowflake',
    warnings: []
  }

  return {
    ping: vi.fn(async () => 'pong'),
    getSettings: vi.fn(async () => defaultSettings()),
    updateSettings: vi.fn(async (nextSettings: Partial<AppSettings>) => ({
      ...defaultSettings(),
      ...nextSettings,
      updatedAt: '2026-04-22T01:00:00.000Z'
    })),
    getStorageSnapshot: vi.fn(async () => defaultSnapshot()),
    exportSnowflakePackage: vi.fn(async () => exportResult),
    exportJsonSnapshot: vi.fn(async (): Promise<ExportResult> => ({
      ...exportResult,
      format: 'json',
      filePath: 'D:/projects/snowflake/test-data/export.json'
    })),
    createBackupSnapshot: vi.fn(async (): Promise<ExportResult> => ({
      ...exportResult,
      filePath: 'D:/projects/snowflake/test-data/backup.snowflake'
    })),
    importSnowflakePackage: vi.fn(async (mode: ImportMode, _includeSettings: boolean): Promise<ImportResult> => ({
      ...importResult,
      mode
    })),
    getAnalyticsSnapshot: vi.fn(async (_input: AnalyticsQueryInput) => defaultAnalyticsSnapshot()),
    getTaskDocument: vi.fn(async () => defaultTaskDocument()),
    getJournalDocument: vi.fn(async () => defaultJournalDocument()),
    upsertJournalEntry: vi.fn(async (_input: UpsertJournalEntryInput) => defaultJournalDocument()),
    deleteJournalEntry: vi.fn(async (_entryId: string) => defaultJournalDocument()),
    restoreJournalEntry: vi.fn(async (_entryId: string) => defaultJournalDocument()),
    getCompletedTaskReferencesByDate: vi.fn(async (_date: string): Promise<JournalTaskReference[]> => []),
    createTask: vi.fn(async (_input: CreateTaskInput) => defaultTaskDocument()),
    updateTask: vi.fn(async (_taskId: string, _input: UpdateTaskInput) => defaultTaskDocument()),
    removeTask: vi.fn(async (_taskId: string) => defaultTaskDocument()),
    addChecklistItem: vi.fn(async (_taskId: string, _input: CreateChecklistItemInput) => defaultTaskDocument()),
    toggleChecklistItem: vi.fn(async (_taskId: string, _checklistItemId: string) => defaultTaskDocument()),
    removeChecklistItem: vi.fn(async (_taskId: string, _checklistItemId: string) => defaultTaskDocument()),

    showNotification: vi.fn(async (_options: NotificationOptions): Promise<NotificationResult> => ({
      success: true,
      notificationId: 'test-notification-123'
    })),
    getShortcuts: vi.fn(async (): Promise<ShortcutDefinition[]> => defaultShortcuts()),
    updateShortcut: vi.fn(async (_action: ShortcutAction, _enabled: boolean): Promise<ShortcutDefinition[]> => defaultShortcuts()),

    logDebug: vi.fn(async (_module: string, _message: string, _data?: Record<string, unknown>): Promise<void> => {}),
    logInfo: vi.fn(async (_module: string, _message: string, _data?: Record<string, unknown>): Promise<void> => {}),
    logWarn: vi.fn(async (_module: string, _message: string, _data?: Record<string, unknown>): Promise<void> => {}),
    logError: vi.fn(async (_module: string, _message: string, _data?: Record<string, unknown>): Promise<void> => {}),
    getLogs: vi.fn(async (_filter?: LogFilter): Promise<LogEntry[]> => defaultLogs()),
    ...overrides
  }
}

export function installDesktopApiMock(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const desktopApi = createDesktopApiMock(overrides)
  window.desktopApi = desktopApi
  return desktopApi
}
