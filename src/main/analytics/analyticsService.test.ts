import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { JournalService } from '@main/journal/journalService'
import { FileStorage } from '@main/storage/fileStorage'
import { TaskService } from '@main/tasks/taskService'
import { AnalyticsService } from './analyticsService'

const tempDirectories: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const createServices = async (): Promise<{
  analyticsService: AnalyticsService
  journalService: JournalService
  taskService: TaskService
}> => {
  const directory = await mkdtemp(join(tmpdir(), 'snowflake-analytics-'))
  tempDirectories.push(directory)
  const storage = new FileStorage(directory)
  await storage.ensureReady()

  return {
    analyticsService: new AnalyticsService(storage),
    journalService: new JournalService(storage),
    taskService: new TaskService(storage)
  }
}

describe('AnalyticsService', () => {
  test('aggregates category, efficiency, trend, and heatmap data', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { analyticsService, journalService, taskService } = await createServices()

    vi.setSystemTime(new Date('2026-04-20T09:00:00.000Z'))
    let taskDocument = await taskService.createTask({
      title: 'Write report',
      categoryId: 'work',
      estimatedMinutes: 60
    })
    const workTask = taskDocument.tasks[0]
    await taskService.updateTask(workTask.id, { status: 'in_progress' })
    vi.setSystemTime(new Date('2026-04-20T10:30:00.000Z'))
    await taskService.updateTask(workTask.id, { status: 'done' })

    vi.setSystemTime(new Date('2026-04-21T08:00:00.000Z'))
    taskDocument = await taskService.createTask({
      title: 'Morning reading',
      categoryId: 'reading',
      estimatedMinutes: 30
    })
    const readingTask = taskDocument.tasks[0]
    await taskService.updateTask(readingTask.id, { status: 'in_progress' })
    vi.setSystemTime(new Date('2026-04-21T08:20:00.000Z'))
    await taskService.updateTask(readingTask.id, { status: 'done' })

    await journalService.upsertJournalEntry({
      entryType: 'daily',
      date: '2026-04-20',
      title: '日报',
      content: '完成了报告'
    })
    await journalService.upsertJournalEntry({
      entryType: 'note',
      date: '2026-04-21',
      title: '复盘笔记',
      content: '阅读摘录'
    })

    const snapshot = await analyticsService.getSnapshot({
      startDate: '2026-04-20',
      endDate: '2026-04-21'
    })

    expect(snapshot.completedTaskCount).toBe(2)
    expect(snapshot.totalFocusMinutes).toBe(110)
    expect(snapshot.totalJournalEntries).toBe(2)
    expect(snapshot.topCategory).toMatchObject({
      categoryId: 'work',
      totalMinutes: 90
    })
    expect(snapshot.dailySummaries).toEqual([
      expect.objectContaining({
        date: '2026-04-20',
        completedTasks: 1,
        totalMinutes: 90
      }),
      expect.objectContaining({
        date: '2026-04-21',
        completedTasks: 1,
        totalMinutes: 20
      })
    ])
    expect(snapshot.categoryStats[1]).toMatchObject({
      categoryId: 'reading',
      totalMinutes: 20
    })
    expect(snapshot.efficiencyRecords[0]).toMatchObject({
      taskId: workTask.id,
      ratio: 1.5,
      isOvertime: false
    })
    expect(
      snapshot.heatmapPoints.filter((point) => point.type === 'journal' && point.value > 0)
    ).toHaveLength(2)
    expect(snapshot.taskDetails.map((task) => task.taskId)).toEqual(
      expect.arrayContaining([workTask.id, readingTask.id])
    )
  })

  test('enforces valid ranges and maximum 365 day span', async () => {
    const { analyticsService } = await createServices()

    await expect(
      analyticsService.getSnapshot({
        startDate: '2026-05-01',
        endDate: '2026-04-01'
      })
    ).rejects.toThrow('Analytics startDate must be earlier than endDate.')

    await expect(
      analyticsService.getSnapshot({
        startDate: '2025-01-01',
        endDate: '2026-04-01'
      })
    ).rejects.toThrow('Analytics range cannot exceed 365 days.')
  })
})
