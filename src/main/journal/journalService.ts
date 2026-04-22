import {
  type JournalDocument,
  type JournalEntry,
  type JournalLinkedTaskSnapshot,
  type JournalTaskReference,
  type JournalTemplate,
  type UpsertJournalEntryInput
} from '@shared/schema'
import { FileStorage } from '@main/storage/fileStorage'
import { DEFAULT_JOURNAL_DOCUMENT } from '@main/storage/defaults'

const IMMEDIATE_WRITE_MS = 0

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const formatDateKey = (value: Date): string => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeDateKey = (value: string): string => {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Journal date is required.')
  }

  return formatDateKey(parsed)
}

const defaultTitle = (entryType: JournalEntry['entryType'], date: string): string =>
  entryType === 'daily' ? `${date} 日报` : '未命名笔记'

const normalizeEntryType = (value: unknown): JournalEntry['entryType'] => (value === 'daily' ? 'daily' : 'note')

const normalizeTimestamp = (value: unknown, fallback: string): string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback

type NormalizedJournalDocument = {
  stored: JournalDocument
  changed: boolean
}

export class JournalService {
  constructor(private readonly storage: FileStorage) {}

  async getJournalDocument(): Promise<JournalDocument> {
    return this.getPersistedJournalDocument()
  }

  async upsertJournalEntry(input: UpsertJournalEntryInput): Promise<JournalDocument> {
    const document = await this.getPersistedJournalDocument()
    const date = normalizeDateKey(input.date)
    const now = new Date().toISOString()
    const existingEntry = input.id ? document.entries.find((entry) => entry.id === input.id) ?? null : null
    const existingDaily =
      input.entryType === 'daily'
        ? document.entries.find(
            (entry) =>
              !entry.isDeleted &&
              entry.entryType === 'daily' &&
              entry.date === date &&
              entry.id !== input.id
          ) ?? null
        : null
    const targetEntry = existingEntry ?? existingDaily

    const linkedTaskIds = [...new Set((input.linkedTaskIds ?? targetEntry?.linkedTaskIds ?? []).filter(Boolean))]
    const linkedTasksSnapshot = await this.buildLinkedTaskSnapshots(
      linkedTaskIds,
      targetEntry?.linkedTasksSnapshot ?? []
    )

    const nextEntry: JournalEntry = {
      id: targetEntry?.id ?? createId(),
      entryType: input.entryType,
      date,
      title: input.title?.trim() || targetEntry?.title || defaultTitle(input.entryType, date),
      content: input.content ?? targetEntry?.content ?? '',
      contentFormat: 'plain_text',
      linkedTaskIds,
      linkedTasksSnapshot,
      templateId: input.templateId ?? targetEntry?.templateId ?? null,
      isDeleted: false,
      deletedAt: null,
      createdAt: targetEntry?.createdAt ?? now,
      updatedAt: now
    }

    const nextDocument: JournalDocument = {
      ...document,
      entries: targetEntry
        ? document.entries.map((entry) => (entry.id === targetEntry.id ? nextEntry : entry))
        : [nextEntry, ...document.entries]
    }

    return this.saveDocument(nextDocument)
  }

  async deleteJournalEntry(entryId: string): Promise<JournalDocument> {
    const document = await this.getPersistedJournalDocument()
    const targetEntry = document.entries.find((entry) => entry.id === entryId)
    if (!targetEntry) {
      throw new Error('Journal entry not found.')
    }

    if (targetEntry.isDeleted) {
      return document
    }

    const now = new Date().toISOString()
    return this.saveDocument({
      ...document,
      entries: document.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              isDeleted: true,
              deletedAt: now,
              updatedAt: now
            }
          : entry
      )
    })
  }

  async restoreJournalEntry(entryId: string): Promise<JournalDocument> {
    const document = await this.getPersistedJournalDocument()
    const targetEntry = document.entries.find((entry) => entry.id === entryId)
    if (!targetEntry) {
      throw new Error('Journal entry not found.')
    }

    if (!targetEntry.isDeleted) {
      return document
    }

    if (
      targetEntry.entryType === 'daily' &&
      document.entries.some(
        (entry) =>
          entry.id !== entryId &&
          !entry.isDeleted &&
          entry.entryType === 'daily' &&
          entry.date === targetEntry.date
      )
    ) {
      throw new Error('A daily journal already exists for this date.')
    }

    const now = new Date().toISOString()
    return this.saveDocument({
      ...document,
      entries: document.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              isDeleted: false,
              deletedAt: null,
              updatedAt: now
            }
          : entry
      )
    })
  }

  async getCompletedTaskReferencesByDate(date: string): Promise<JournalTaskReference[]> {
    const taskDocument = await this.storage.readDocument('tasks')
    const targetDate = normalizeDateKey(date)
    const categoryMap = new Map(taskDocument.categories.map((category) => [category.id, category.name]))

    return taskDocument.tasks
      .filter(
        (task) =>
          task.status === 'done' &&
          task.completedAt !== null &&
          formatDateKey(new Date(task.completedAt)) === targetDate
      )
      .sort((left, right) => Date.parse(right.completedAt ?? '') - Date.parse(left.completedAt ?? ''))
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        completedAt: task.completedAt as string,
        categoryName: categoryMap.get(task.categoryId) ?? '未分类',
        actualMinutes: task.actualMinutes
      }))
  }

  private async buildLinkedTaskSnapshots(
    linkedTaskIds: string[],
    existingSnapshots: JournalLinkedTaskSnapshot[]
  ): Promise<JournalLinkedTaskSnapshot[]> {
    if (linkedTaskIds.length === 0) {
      return []
    }

    const taskDocument = await this.storage.readDocument('tasks')
    const taskMap = new Map(taskDocument.tasks.map((task) => [task.id, task]))
    const snapshotMap = new Map(existingSnapshots.map((snapshot) => [snapshot.taskId, snapshot]))

    return linkedTaskIds
      .map((taskId) => {
        const task = taskMap.get(taskId)
        if (task?.completedAt) {
          return {
            taskId,
            title: task.title,
            completedAt: task.completedAt
          }
        }

        return snapshotMap.get(taskId) ?? null
      })
      .filter((snapshot): snapshot is JournalLinkedTaskSnapshot => snapshot !== null)
  }

  private async getPersistedJournalDocument(): Promise<JournalDocument> {
    const document = await this.storage.readDocument('journals')
    const normalized = this.normalizeDocument(document)
    if (normalized.changed) {
      await this.storage.scheduleWrite('journals', normalized.stored, IMMEDIATE_WRITE_MS)
    }

    return normalized.stored
  }

  private normalizeDocument(document: JournalDocument): NormalizedJournalDocument {
    const defaultTemplates = DEFAULT_JOURNAL_DOCUMENT.templates
    const templateMap = new Map<string, JournalTemplate>()
    for (const template of defaultTemplates) {
      templateMap.set(template.id, template)
    }
    for (const template of Array.isArray(document.templates) ? document.templates : []) {
      if (!template || typeof template !== 'object' || typeof template.id !== 'string') {
        continue
      }

      templateMap.set(template.id, {
        id: template.id,
        name: typeof template.name === 'string' ? template.name : '未命名模板',
        type: template.type === 'weekly' ? 'weekly' : 'daily',
        templateContent: typeof template.templateContent === 'string' ? template.templateContent : '',
        isDefault: Boolean(template.isDefault)
      })
    }

    const now = new Date().toISOString()
    const entries = (Array.isArray(document.entries) ? document.entries : [])
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const entryType = normalizeEntryType(entry.entryType)
        const date = normalizeDateKey(typeof entry.date === 'string' ? entry.date : now)
        const createdAt = normalizeTimestamp(entry.createdAt, now)
        const updatedAt = normalizeTimestamp(entry.updatedAt, createdAt)

        return {
          id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : createId(),
          entryType,
          date,
          title:
            typeof entry.title === 'string' && entry.title.trim()
              ? entry.title.trim()
              : defaultTitle(entryType, date),
          content: typeof entry.content === 'string' ? entry.content : '',
          contentFormat: 'plain_text' as const,
          linkedTaskIds: Array.isArray(entry.linkedTaskIds)
            ? entry.linkedTaskIds.filter((taskId): taskId is string => typeof taskId === 'string')
            : [],
          linkedTasksSnapshot: Array.isArray(entry.linkedTasksSnapshot)
            ? entry.linkedTasksSnapshot.filter(
                (snapshot): snapshot is JournalLinkedTaskSnapshot =>
                  Boolean(
                    snapshot &&
                      typeof snapshot === 'object' &&
                      typeof snapshot.taskId === 'string' &&
                      typeof snapshot.title === 'string'
                  )
              )
            : [],
          templateId: typeof entry.templateId === 'string' ? entry.templateId : null,
          isDeleted: Boolean(entry.isDeleted),
          deletedAt: typeof entry.deletedAt === 'string' ? entry.deletedAt : null,
          createdAt,
          updatedAt
        }
      })
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))

    const stored: JournalDocument = {
      version: document.version ?? DEFAULT_JOURNAL_DOCUMENT.version,
      entries,
      templates: [...templateMap.values()]
    }

    return {
      stored,
      changed: JSON.stringify(document) !== JSON.stringify(stored)
    }
  }

  private async saveDocument(document: JournalDocument, debounceMs?: number): Promise<JournalDocument> {
    const normalized = this.normalizeDocument(document)
    return this.storage.scheduleWrite('journals', normalized.stored, debounceMs)
  }
}
