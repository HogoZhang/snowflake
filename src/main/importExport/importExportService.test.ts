import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import JSZip from 'jszip'
import { afterEach, describe, expect, test } from 'vitest'

import { JournalService } from '@main/journal/journalService'
import { FileStorage } from '@main/storage/fileStorage'
import { TaskService } from '@main/tasks/taskService'
import { ImportExportService } from './importExportService'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const createServices = async (): Promise<{
  directory: string
  storage: FileStorage
  importExportService: ImportExportService
  journalService: JournalService
  taskService: TaskService
}> => {
  const directory = await mkdtemp(join(tmpdir(), 'snowflake-import-export-'))
  tempDirectories.push(directory)
  const storage = new FileStorage(directory)
  await storage.ensureReady()

  return {
    directory,
    storage,
    importExportService: new ImportExportService(storage, '0.1.0-test'),
    journalService: new JournalService(storage),
    taskService: new TaskService(storage)
  }
}

describe('ImportExportService', () => {
  test('exports a .snowflake package with manifest and documents', async () => {
    const { directory, importExportService, taskService } = await createServices()
    await taskService.createTask({ title: 'Package me' })

    const filePath = join(directory, 'export.snowflake')
    const result = await importExportService.exportSnowflakePackage(filePath)

    expect(result.format).toBe('snowflake')
    const zip = await JSZip.loadAsync(await readFile(filePath))
    const manifest = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '{}')
    const tasks = JSON.parse((await zip.file('tasks.json')?.async('string')) ?? '{}')

    expect(manifest.includedFiles).toHaveLength(3)
    expect(tasks.tasks[0].title).toBe('Package me')
  })

  test('imports and merges documents by id', async () => {
    const source = await createServices()
    const target = await createServices()

    let taskDocument = await source.taskService.createTask({ title: 'Imported task' })
    await source.journalService.upsertJournalEntry({
      entryType: 'daily',
      date: '2026-04-22',
      title: 'Imported daily'
    })

    await target.taskService.createTask({ title: 'Existing task' })
    const packagePath = join(source.directory, 'merge.snowflake')
    await source.importExportService.exportSnowflakePackage(packagePath)

    const result = await target.importExportService.importSnowflakePackage(packagePath, 'merge', false)
    expect(result.mode).toBe('merge')

    taskDocument = await target.taskService.getTaskDocument()
    const journalDocument = await target.journalService.getJournalDocument()
    expect(taskDocument.tasks.map((task) => task.title)).toEqual(
      expect.arrayContaining(['Imported task', 'Existing task'])
    )
    expect(journalDocument.entries.map((entry) => entry.title)).toContain('Imported daily')
  })

  test('restores previous documents when import write fails', async () => {
    const source = await createServices()
    const target = await createServices()

    await source.taskService.createTask({ title: 'Incoming task' })
    const packagePath = join(source.directory, 'rollback.snowflake')
    await source.importExportService.exportSnowflakePackage(packagePath)

    await target.taskService.createTask({ title: 'Original task' })

    let firstCall = true
    const originalReplaceDocuments = target.storage.replaceDocuments.bind(target.storage)
    target.storage.replaceDocuments = (async (documents) => {
      if (firstCall) {
        firstCall = false
        if (documents.tasks) {
          await originalReplaceDocuments({ tasks: documents.tasks })
        }
        throw new Error('Simulated import failure.')
      }

      return originalReplaceDocuments(documents)
    }) as typeof target.storage.replaceDocuments

    await expect(
      target.importExportService.importSnowflakePackage(packagePath, 'overwrite', false)
    ).rejects.toThrow('Simulated import failure.')

    const restoredDocument = await target.taskService.getTaskDocument()
    expect(restoredDocument.tasks.map((task) => task.title)).toEqual(['Original task'])
  })
})
