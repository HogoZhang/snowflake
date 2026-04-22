import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { FileStorage } from '@main/storage/fileStorage'
import { TaskService } from '@main/tasks/taskService'
import { JournalService } from './journalService'

const tempDirectories: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const createServices = async (): Promise<{
  journalService: JournalService
  taskService: TaskService
}> => {
  const directory = await mkdtemp(join(tmpdir(), 'snowflake-journal-'))
  tempDirectories.push(directory)
  const storage = new FileStorage(directory)
  await storage.ensureReady()

  return {
    journalService: new JournalService(storage),
    taskService: new TaskService(storage)
  }
}

describe('JournalService', () => {
  test('initializes default templates', async () => {
    const { journalService } = await createServices()

    const document = await journalService.getJournalDocument()

    expect(document.templates.map((template) => template.id)).toEqual(
      expect.arrayContaining(['daily-template', 'weekly-template'])
    )
  })

  test('keeps only one daily entry per date', async () => {
    const { journalService } = await createServices()

    let document = await journalService.upsertJournalEntry({
      entryType: 'daily',
      date: '2026-04-22',
      title: '第一版日报',
      content: 'A'
    })

    const firstEntryId = document.entries[0].id

    document = await journalService.upsertJournalEntry({
      entryType: 'daily',
      date: '2026-04-22',
      title: '更新后的日报',
      content: 'B'
    })

    const activeDailyEntries = document.entries.filter(
      (entry) => entry.entryType === 'daily' && entry.date === '2026-04-22' && !entry.isDeleted
    )

    expect(activeDailyEntries).toHaveLength(1)
    expect(activeDailyEntries[0]).toMatchObject({
      id: firstEntryId,
      title: '更新后的日报',
      content: 'B'
    })
  })

  test('allows multiple note entries on the same date', async () => {
    const { journalService } = await createServices()

    let document = await journalService.upsertJournalEntry({
      entryType: 'note',
      date: '2026-04-22',
      title: '笔记一',
      content: 'alpha'
    })

    document = await journalService.upsertJournalEntry({
      entryType: 'note',
      date: '2026-04-22',
      title: '笔记二',
      content: 'beta'
    })

    const activeNotes = document.entries.filter((entry) => entry.entryType === 'note' && !entry.isDeleted)
    expect(activeNotes).toHaveLength(2)
  })

  test('returns completed task references for a given date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-04-22T09:00:00.000Z'))
    const { journalService, taskService } = await createServices()

    let taskDocument = await taskService.createTask({ title: '完成的任务' })
    const doneTask = taskDocument.tasks[0]
    taskDocument = await taskService.createTask({ title: '另一天的任务' })
    const oldTask = taskDocument.tasks.find((task) => task.id !== doneTask.id)!

    taskDocument = await taskService.updateTask(doneTask.id, { status: 'done' })
    vi.setSystemTime(new Date('2026-04-20T10:00:00.000Z'))
    await taskService.updateTask(oldTask.id, { status: 'done' })

    const references = await journalService.getCompletedTaskReferencesByDate('2026-04-22')

    expect(references).toHaveLength(1)
    expect(references[0]).toMatchObject({
      taskId: doneTask.id,
      title: '完成的任务'
    })
  })

  test('preserves linked task snapshots after the task is deleted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-04-22T09:00:00.000Z'))
    const { journalService, taskService } = await createServices()

    let taskDocument = await taskService.createTask({ title: '会被删除的任务' })
    const task = taskDocument.tasks[0]
    await taskService.updateTask(task.id, { status: 'done' })

    let document = await journalService.upsertJournalEntry({
      entryType: 'daily',
      date: '2026-04-22',
      title: '日报',
      linkedTaskIds: [task.id]
    })

    expect(document.entries[0].linkedTasksSnapshot[0]).toMatchObject({
      taskId: task.id,
      title: '会被删除的任务'
    })

    await taskService.removeTask(task.id)
    document = await journalService.getJournalDocument()

    expect(document.entries[0].linkedTaskIds).toEqual([task.id])
    expect(document.entries[0].linkedTasksSnapshot[0]).toMatchObject({
      taskId: task.id,
      title: '会被删除的任务'
    })
  })

  test('prevents restoring a deleted daily entry when another daily exists for the date', async () => {
    const { journalService } = await createServices()

    let document = await journalService.upsertJournalEntry({
      entryType: 'daily',
      date: '2026-04-22',
      title: '日报 A'
    })
    const entryId = document.entries[0].id

    document = await journalService.deleteJournalEntry(entryId)
    expect(document.entries[0].isDeleted).toBe(true)

    await journalService.upsertJournalEntry({
      entryType: 'daily',
      date: '2026-04-22',
      title: '日报 B'
    })

    await expect(journalService.restoreJournalEntry(entryId)).rejects.toThrow(
      'A daily journal already exists for this date.'
    )
  })
})
