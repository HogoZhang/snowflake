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
    importSnowflakePackage: vi.fn(async (mode: ImportMode): Promise<ImportResult> => ({
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
    ...overrides
  }
}

export function installDesktopApiMock(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const desktopApi = createDesktopApiMock(overrides)
  window.desktopApi = desktopApi
  return desktopApi
}
