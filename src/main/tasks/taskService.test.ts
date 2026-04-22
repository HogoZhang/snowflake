import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { FileStorage } from '@main/storage/fileStorage'
import { TaskService } from './taskService'

const tempDirectories: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const createService = async (directory?: string): Promise<{ directory: string; service: TaskService }> => {
  const resolvedDirectory = directory ?? (await mkdtemp(join(tmpdir(), 'snowflake-tasks-')))
  if (!tempDirectories.includes(resolvedDirectory)) {
    tempDirectories.push(resolvedDirectory)
  }

  const storage = new FileStorage(resolvedDirectory)
  await storage.ensureReady()
  return {
    directory: resolvedDirectory,
    service: new TaskService(storage)
  }
}

describe('TaskService', () => {
  test('creates tasks with defaults', async () => {
    const { service } = await createService()

    const document = await service.createTask({
      title: 'Write Phase 2 implementation'
    })

    expect(document.tasks).toHaveLength(1)
    expect(document.tasks[0]).toMatchObject({
      title: 'Write Phase 2 implementation',
      status: 'todo',
      priority: 'medium',
      estimatedMinutes: 30
    })
    expect(document.timeLogs).toEqual([])
  })

  test('keeps only one active timer and closes the previous log', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-04-22T09:00:00.000Z'))
    const { service } = await createService()

    let document = await service.createTask({ title: 'Task A' })
    document = await service.createTask({ title: 'Task B' })

    const [taskB, taskA] = document.tasks
    document = await service.updateTask(taskA.id, { status: 'in_progress' })
    expect(document.timeLogs.filter((timeLog) => timeLog.endAt === null)).toHaveLength(1)

    vi.setSystemTime(new Date('2026-04-22T09:25:00.000Z'))
    document = await service.updateTask(taskB.id, { status: 'in_progress' })

    expect(document.tasks.find((task) => task.id === taskB.id)?.status).toBe('in_progress')
    expect(document.tasks.find((task) => task.id === taskA.id)?.status).toBe('todo')
    expect(document.timeLogs.filter((timeLog) => timeLog.endAt === null)).toHaveLength(1)
    expect(document.timeLogs.find((timeLog) => timeLog.taskId === taskA.id)).toMatchObject({
      endAt: '2026-04-22T09:25:00.000Z',
      durationMinutes: 25
    })
  })

  test('prevents edits on archived tasks', async () => {
    const { service } = await createService()

    let document = await service.createTask({ title: 'Archive me' })
    const task = document.tasks[0]
    document = await service.updateTask(task.id, { status: 'done' })
    document = await service.updateTask(task.id, { status: 'archived' })

    await expect(service.updateTask(task.id, { title: 'Edited' })).rejects.toThrow(
      'Archived tasks are read-only.'
    )
  })

  test('pauses and completes timers while accumulating actual minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-04-22T10:00:00.000Z'))
    const { service } = await createService()

    let document = await service.createTask({ title: 'Focus task' })
    const task = document.tasks[0]

    document = await service.updateTask(task.id, { status: 'in_progress' })
    vi.setSystemTime(new Date('2026-04-22T10:42:00.000Z'))
    document = await service.updateTask(task.id, { status: 'todo' })
    expect(document.tasks[0].actualMinutes).toBe(42)
    expect(document.timeLogs[0].durationMinutes).toBe(42)

    vi.setSystemTime(new Date('2026-04-22T11:00:00.000Z'))
    document = await service.updateTask(task.id, { status: 'in_progress' })
    vi.setSystemTime(new Date('2026-04-22T11:18:00.000Z'))
    document = await service.updateTask(task.id, { status: 'done' })

    expect(document.tasks[0]).toMatchObject({
      status: 'done',
      actualMinutes: 60
    })
    expect(document.timeLogs).toHaveLength(2)
    expect(document.timeLogs.every((timeLog) => timeLog.endAt !== null)).toBe(true)
  })

  test('rebuilds the active timer after reloading from storage', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-04-22T13:00:00.000Z'))
    const { directory, service } = await createService()

    let document = await service.createTask({ title: 'Recover timer' })
    const task = document.tasks[0]
    await service.updateTask(task.id, { status: 'in_progress' })

    vi.setSystemTime(new Date('2026-04-22T13:17:00.000Z'))
    const { service: reloadedService } = await createService(directory)
    document = await reloadedService.getTaskDocument()

    expect(document.tasks[0]).toMatchObject({
      id: task.id,
      status: 'in_progress',
      actualMinutes: 17
    })
    expect(document.timeLogs[0]).toMatchObject({
      taskId: task.id,
      endAt: null
    })
  })

  test('adds and toggles checklist items', async () => {
    const { service } = await createService()

    let document = await service.createTask({ title: 'Task with checklist' })
    const task = document.tasks[0]

    document = await service.addChecklistItem(task.id, { content: 'First item' })
    const checklistItem = document.tasks[0].checklist[0]
    expect(checklistItem.content).toBe('First item')
    expect(checklistItem.isChecked).toBe(false)

    document = await service.toggleChecklistItem(task.id, checklistItem.id)
    expect(document.tasks[0].checklist[0].isChecked).toBe(true)
  })
})
