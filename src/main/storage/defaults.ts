import {
  APP_SCHEMA_VERSION,
  type AppSettings,
  type JournalDocument,
  type JournalTemplate,
  type TaskCategory,
  type TaskDocument
} from '@shared/schema'

const DEFAULT_TASK_CATEGORIES: TaskCategory[] = [
  {
    id: 'work',
    name: '工作',
    color: '#ff6b6b',
    icon: 'briefcase',
    isDefault: true
  },
  {
    id: 'reading',
    name: '阅读',
    color: '#ffd93d',
    icon: 'book-open',
    isDefault: true
  },
  {
    id: 'life',
    name: '生活',
    color: '#7cc7ff',
    icon: 'home',
    isDefault: true
  },
  {
    id: 'fitness',
    name: '健身',
    color: '#7adf9f',
    icon: 'dumbbell',
    isDefault: true
  }
]

const DEFAULT_JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'daily-template',
    name: '日报模板',
    type: 'daily',
    templateContent: ['今日完成', '- ', '', '遇到的问题', '- ', '', '明日计划', '- '].join('\n'),
    isDefault: true
  },
  {
    id: 'weekly-template',
    name: '周总结模板',
    type: 'weekly',
    templateContent: ['本周亮点', '- ', '', '待改进项', '- ', '', '下周重点', '- '].join('\n'),
    isDefault: true
  }
]

export const DEFAULT_TASK_DOCUMENT: TaskDocument = {
  version: APP_SCHEMA_VERSION,
  tasks: [],
  categories: DEFAULT_TASK_CATEGORIES,
  timeLogs: []
}

export const DEFAULT_JOURNAL_DOCUMENT: JournalDocument = {
  version: APP_SCHEMA_VERSION,
  entries: [],
  templates: DEFAULT_JOURNAL_TEMPLATES
}

export const createDefaultSettings = (storagePath: string): AppSettings => ({
  version: APP_SCHEMA_VERSION,
  activeThemeId: 'default',
  storagePath,
  autoSaveIntervalMs: 500,
  locale: 'zh-CN',
  useSystemTitleBar: false,
  updatedAt: new Date().toISOString()
})
