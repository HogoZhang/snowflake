import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, test } from 'vitest'

import { FileStorage } from './fileStorage'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const createStorage = async (): Promise<{ storage: FileStorage; directory: string }> => {
  const directory = await mkdtemp(join(tmpdir(), 'snowflake-storage-'))
  tempDirectories.push(directory)
  const storage = new FileStorage(directory)
  await storage.ensureReady()
  return { storage, directory }
}

describe('FileStorage', () => {
  test('initializes all base documents', async () => {
    const { storage, directory } = await createStorage()

    const settings = await storage.getSettings()
    const tasksContent = await readFile(join(directory, 'tasks.json'), 'utf-8')

    expect(settings.storagePath).toBe(directory)
    expect(JSON.parse(tasksContent)).toMatchObject({
      tasks: []
    })
    expect(JSON.parse(tasksContent).categories).toHaveLength(4)
  })

  test('debounces repeated writes and persists the latest settings payload', async () => {
    const { storage } = await createStorage()

    const firstWrite = storage.scheduleWrite('settings', {
      ...(await storage.getSettings()),
      locale: 'en-US'
    })
    const secondWrite = storage.scheduleWrite('settings', {
      ...(await storage.getSettings()),
      activeThemeId: 'shinchan'
    })

    await Promise.all([firstWrite, secondWrite])
    await storage.flushPendingWrites()

    const persisted = await storage.getSettings()
    expect(persisted.activeThemeId).toBe('shinchan')
  })

  test('creates a backup file when overwriting an existing document', async () => {
    const { storage, directory } = await createStorage()

    await storage.updateSettings({ locale: 'en-US' })
    await storage.flushPendingWrites()

    const backupStats = await stat(join(directory, 'settings.json.bak'))
    expect(backupStats.isFile()).toBe(true)
  })

  test('migrates the storage directory and updates the snapshot', async () => {
    const { storage, directory } = await createStorage()
    const nextDirectory = join(directory, 'migrated-data')

    await storage.updateSettings({ storagePath: nextDirectory })
    const snapshot = await storage.getSnapshot()
    const migratedSettings = await storage.getSettings()

    expect(snapshot.dataDirectory).toBe(nextDirectory)
    expect(migratedSettings.storagePath).toBe(nextDirectory)
  })
})
