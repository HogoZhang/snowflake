export const APP_SCHEMA_VERSION = 1

export type ThemeId = 'default' | 'shinchan' | 'mickey'
export type ThemeAssetType = 'font' | 'icon' | 'image'
export type Locale = 'zh-CN' | 'en-US'
export type DocumentKey = 'tasks' | 'journals' | 'settings'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived'
export type TaskPriority = 'low' | 'medium' | 'high'
export type JournalEntryType = 'daily' | 'note'
export type JournalTemplateType = 'daily' | 'weekly'
export type JournalContentFormat = 'plain_text'
export type AnalyticsHeatmapType = 'task' | 'journal'
export type ImportMode = 'overwrite' | 'merge'
export type ExportFormat = 'snowflake' | 'json'

export interface TaskCategory {
  id: string
  name: string
  color: string
  icon: string
  isDefault: boolean
}

export interface ChecklistItem {
  id: string
  content: string
  isChecked: boolean
}

export interface TimeLog {
  id: string
  taskId: string
  startAt: string
  endAt: string | null
  durationMinutes: number
}

export interface TaskRecord {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  categoryId: string
  estimatedMinutes: number
  actualMinutes: number
  dueDate: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  checklist: ChecklistItem[]
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: TaskPriority
  categoryId?: string
  estimatedMinutes?: number
  dueDate?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  priority?: TaskPriority
  categoryId?: string
  estimatedMinutes?: number
  dueDate?: string | null
  status?: TaskStatus
}

export interface CreateChecklistItemInput {
  content: string
}

export interface TaskDocument {
  version: number
  tasks: TaskRecord[]
  categories: TaskCategory[]
  timeLogs: TimeLog[]
}

export interface JournalLinkedTaskSnapshot {
  taskId: string
  title: string
  completedAt: string | null
}

export interface JournalTaskReference {
  taskId: string
  title: string
  completedAt: string
  categoryName: string
  actualMinutes: number
}

export interface JournalEntry {
  id: string
  entryType: JournalEntryType
  date: string
  title: string
  content: string
  contentFormat: JournalContentFormat
  linkedTaskIds: string[]
  linkedTasksSnapshot: JournalLinkedTaskSnapshot[]
  templateId: string | null
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface JournalTemplate {
  id: string
  name: string
  type: JournalTemplateType
  templateContent: string
  isDefault: boolean
}

export interface UpsertJournalEntryInput {
  id?: string
  entryType: JournalEntryType
  date: string
  title?: string
  content?: string
  linkedTaskIds?: string[]
  templateId?: string | null
}

export interface JournalDocument {
  version: number
  entries: JournalEntry[]
  templates: JournalTemplate[]
}

export interface DailySummaryCategoryBreakdown {
  categoryId: string
  categoryName: string
  totalMinutes: number
}

export interface DailySummary {
  date: string
  totalTasks: number
  completedTasks: number
  totalMinutes: number
  categoryBreakdown: DailySummaryCategoryBreakdown[]
}

export interface CategoryStat {
  categoryId: string
  categoryName: string
  totalMinutes: number
  taskCount: number
  period: string
}

export interface EfficiencyRecord {
  taskId: string
  taskTitle: string
  categoryId: string
  categoryName: string
  estimatedMinutes: number
  actualMinutes: number
  ratio: number
  isOvertime: boolean
  completedAt: string | null
}

export interface HeatmapPoint {
  date: string
  value: number
  type: AnalyticsHeatmapType
}

export interface AnalyticsTaskDetail {
  taskId: string
  title: string
  categoryId: string
  categoryName: string
  completedAt: string | null
  actualMinutes: number
  estimatedMinutes: number
  status: TaskStatus
}

export interface AnalyticsJournalDetail {
  entryId: string
  title: string
  date: string
  entryType: JournalEntryType
}

export interface AnalyticsQueryInput {
  startDate: string
  endDate: string
}

export interface AnalyticsSnapshot {
  range: AnalyticsQueryInput
  completedTaskCount: number
  totalFocusMinutes: number
  totalJournalEntries: number
  topCategory: CategoryStat | null
  dailySummaries: DailySummary[]
  categoryStats: CategoryStat[]
  efficiencyRecords: EfficiencyRecord[]
  heatmapPoints: HeatmapPoint[]
  taskDetails: AnalyticsTaskDetail[]
  journalDetails: AnalyticsJournalDetail[]
}

export interface ExportedFileManifest {
  fileName: DocumentKey
  checksum: string
  byteLength: number
}

export interface ExportPackageManifest {
  version: number
  appVersion: string
  schemaVersion: number
  exportedAt: string
  includedFiles: ExportedFileManifest[]
  checksum: string
}

export interface ExportResult {
  format: ExportFormat
  filePath: string
  byteLength: number
  exportedAt: string
}

export interface ThemeDefinition {
  id: string
  name: string
  displayName: string
  cssVars: Record<string, string>
  fontFamily: string
  iconSet: string
  previewImage: string
  isCustom?: boolean
}

export interface ThemeAsset {
  themeId: string
  assetType: ThemeAssetType
  filePath: string
}

export interface ActiveTheme {
  themeId: string
  appliedAt: string
}

export interface CustomTheme extends ThemeDefinition {
  isCustom: true
}

export interface ImportValidationResult {
  isValid: boolean
  version: number | null
  warnings: string[]
  conflicts: string[]
}

export interface ImportResult {
  filePath: string
  mode: ImportMode
  importedDocuments: DocumentKey[]
  backupPath: string
  warnings: string[]
}

export interface AppSettings {
  version: number
  activeThemeId: ThemeId
  storagePath: string
  autoSaveIntervalMs: number
  locale: Locale
  useSystemTitleBar: boolean
  updatedAt: string
}

export interface StorageSnapshot {
  dataDirectory: string
  availableDocuments: DocumentKey[]
  schemaVersion: number
}

export type NotificationType = 'task_due' | 'task_completed' | 'timer_complete' | 'reminder' | 'success' | 'error'

export interface NotificationOptions {
  type: NotificationType
  title: string
  body: string
  silent?: boolean
  urgency?: 'low' | 'normal' | 'critical'
}

export interface NotificationResult {
  success: boolean
  notificationId?: string
}

export type ShortcutAction =
  | 'new_task'
  | 'toggle_timer'
  | 'complete_task'
  | 'open_tasks'
  | 'open_journal'
  | 'open_analytics'
  | 'open_settings'
  | 'search'

export interface ShortcutDefinition {
  action: ShortcutAction
  accelerator: string
  enabled: boolean
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  module: string
  message: string
  data?: Record<string, unknown>
}

export interface LogFilter {
  levels?: Array<LogEntry['level']>
  modules?: string[]
  startDate?: string
  endDate?: string
}

export interface AdvancedSearchQuery {
  keyword: string
  searchInTitle?: boolean
  searchInDescription?: boolean
  searchInContent?: boolean
  statuses?: TaskStatus[]
  priorities?: TaskPriority[]
  categories?: string[]
  entryTypes?: JournalEntryType[]
  startDate?: string
  endDate?: string
  exactMatch?: boolean
}

export interface DesktopApi {
  ping: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  updateSettings: (nextSettings: Partial<AppSettings>) => Promise<AppSettings>
  getStorageSnapshot: () => Promise<StorageSnapshot>
  exportSnowflakePackage: () => Promise<ExportResult>
  exportJsonSnapshot: () => Promise<ExportResult>
  createBackupSnapshot: () => Promise<ExportResult>
  importSnowflakePackage: (mode: ImportMode, includeSettings: boolean) => Promise<ImportResult>
  getAnalyticsSnapshot: (input: AnalyticsQueryInput) => Promise<AnalyticsSnapshot>
  getTaskDocument: () => Promise<TaskDocument>
  getJournalDocument: () => Promise<JournalDocument>
  upsertJournalEntry: (input: UpsertJournalEntryInput) => Promise<JournalDocument>
  deleteJournalEntry: (entryId: string) => Promise<JournalDocument>
  restoreJournalEntry: (entryId: string) => Promise<JournalDocument>
  getCompletedTaskReferencesByDate: (date: string) => Promise<JournalTaskReference[]>
  createTask: (input: CreateTaskInput) => Promise<TaskDocument>
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<TaskDocument>
  removeTask: (taskId: string) => Promise<TaskDocument>
  addChecklistItem: (taskId: string, input: CreateChecklistItemInput) => Promise<TaskDocument>
  toggleChecklistItem: (taskId: string, checklistItemId: string) => Promise<TaskDocument>
  removeChecklistItem: (taskId: string, checklistItemId: string) => Promise<TaskDocument>

  showNotification: (options: NotificationOptions) => Promise<NotificationResult>
  getShortcuts: () => Promise<ShortcutDefinition[]>
  updateShortcut: (action: ShortcutAction, enabled: boolean) => Promise<ShortcutDefinition[]>

  logDebug: (module: string, message: string, data?: Record<string, unknown>) => Promise<void>
  logInfo: (module: string, message: string, data?: Record<string, unknown>) => Promise<void>
  logWarn: (module: string, message: string, data?: Record<string, unknown>) => Promise<void>
  logError: (module: string, message: string, data?: Record<string, unknown>) => Promise<void>
  getLogs: (filter?: LogFilter) => Promise<LogEntry[]>
}
