import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import {
  APP_SCHEMA_VERSION,
  type AppSettings,
  type DocumentKey,
  type JournalDocument,
  type StorageSnapshot,
  type TaskDocument
} from '@shared/schema'
import {
  DEFAULT_JOURNAL_DOCUMENT,
  DEFAULT_TASK_DOCUMENT,
  createDefaultSettings
} from './defaults'

type DocumentMap = {
  tasks: TaskDocument
  journals: JournalDocument
  settings: AppSettings
}

type AnyDocument = DocumentMap[DocumentKey]

type PendingWrite = {
  data: AnyDocument
  timer: NodeJS.Timeout
  resolve: Array<(value: AnyDocument) => void>
  reject: Array<(reason?: unknown) => void>
}

const FILE_NAMES: Record<DocumentKey, string> = {
  tasks: 'tasks.json',
  journals: 'journals.json',
  settings: 'settings.json'
}

const DEFAULT_DEBOUNCE_MS = 500

const clone = <T>(value: T): T => structuredClone(value)

export class FileStorage {
  private dataDirectory: string
  private readyPromise: Promise<void> | null = null
  private writeChain: Promise<void> = Promise.resolve()
  private pendingWrites = new Map<DocumentKey, PendingWrite>()

  constructor(dataDirectory: string) {
    this.dataDirectory = resolve(dataDirectory)
  }

  async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.initializeDocuments()
    }

    return this.readyPromise
  }

  async getSettings(): Promise<AppSettings> {
    return this.readDocument('settings')
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.readDocument('settings')
    const nextSettings: AppSettings = {
      ...current,
      ...patch,
      version: APP_SCHEMA_VERSION,
      updatedAt: new Date().toISOString()
    }

    if (patch.storagePath && resolve(patch.storagePath) !== this.dataDirectory) {
      await this.changeStoragePath(patch.storagePath, nextSettings)
      return this.readDocument('settings')
    }

    return this.scheduleWrite('settings', nextSettings)
  }

  async getSnapshot(): Promise<StorageSnapshot> {
    await this.ensureReady()
    return {
      dataDirectory: this.dataDirectory,
      availableDocuments: ['tasks', 'journals', 'settings'],
      schemaVersion: APP_SCHEMA_VERSION
    }
  }

  getDataDirectory(): string {
    return this.dataDirectory
  }

  async readDocument<K extends DocumentKey>(key: K): Promise<DocumentMap[K]> {
    await this.ensureReady()
    const content = await readFile(this.getFilePath(key), 'utf-8')
    return this.parseDocument(key, content)
  }

  async scheduleWrite<K extends DocumentKey>(
    key: K,
    data: DocumentMap[K],
    debounceMs = DEFAULT_DEBOUNCE_MS
  ): Promise<DocumentMap[K]> {
    await this.ensureReady()

    return new Promise<DocumentMap[K]>((resolveWrite, rejectWrite) => {
      const existing = this.pendingWrites.get(key)
      if (existing) {
        clearTimeout(existing.timer)
        existing.data = clone(data)
        existing.resolve.push((value) => resolveWrite(value as DocumentMap[K]))
        existing.reject.push(rejectWrite)
        existing.timer = this.createPendingTimer(key, debounceMs)
        if (debounceMs <= 0) {
          void this.flushKey(key)
        }
        return
      }

      const pending: PendingWrite = {
        data: clone(data),
        resolve: [(value) => resolveWrite(value as DocumentMap[K])],
        reject: [rejectWrite],
        timer: this.createPendingTimer(key, debounceMs)
      }

      this.pendingWrites.set(key, pending)
      if (debounceMs <= 0) {
        void this.flushKey(key)
      }
    })
  }

  async flushPendingWrites(): Promise<void> {
    const keys = [...this.pendingWrites.keys()]
    await Promise.all(keys.map((key) => this.flushKey(key)))
    await this.writeChain
  }

  async changeStoragePath(nextPath: string, settings?: AppSettings): Promise<void> {
    await this.ensureReady()
    await this.flushPendingWrites()

    const targetDirectory = resolve(nextPath)
    if (targetDirectory === this.dataDirectory) {
      return
    }

    await mkdir(targetDirectory, { recursive: true })

    for (const key of ['tasks', 'journals', 'settings'] as const) {
      await cp(this.getFilePath(key), join(targetDirectory, FILE_NAMES[key]), { force: true })
      const backupPath = `${this.getFilePath(key)}.bak`
      try {
        await stat(backupPath)
        await cp(backupPath, `${join(targetDirectory, FILE_NAMES[key])}.bak`, { force: true })
      } catch {
        // Ignore missing backup files.
      }
    }

    this.dataDirectory = targetDirectory
    const nextSettings = settings ?? {
      ...(await this.readDocument('settings')),
      storagePath: targetDirectory,
      updatedAt: new Date().toISOString()
    }
    await this.writeDocumentAtomic('settings', nextSettings)
  }

  async replaceDocuments(documents: Partial<DocumentMap>): Promise<void> {
    await this.ensureReady()
    await this.flushPendingWrites()

    const orderedKeys: DocumentKey[] = ['tasks', 'journals', 'settings']
    for (const key of orderedKeys) {
      const nextDocument = documents[key]
      if (nextDocument) {
        await this.writeDocumentAtomic(key, nextDocument)
      }
    }
  }

  private createPendingTimer(key: DocumentKey, debounceMs: number): NodeJS.Timeout {
    return setTimeout(() => {
      void this.flushKey(key)
    }, debounceMs)
  }

  private async flushKey(key: DocumentKey): Promise<void> {
    const pending = this.pendingWrites.get(key)
    if (!pending) {
      return
    }

    clearTimeout(pending.timer)
    this.pendingWrites.delete(key)

    this.writeChain = this.writeChain.then(async () => {
      try {
        await this.writeDocumentAtomic(key, pending.data)
        pending.resolve.forEach((done) => done(clone(pending.data)))
      } catch (error) {
        pending.reject.forEach((rejectWrite) => rejectWrite(error))
        throw error
      }
    })

    await this.writeChain
  }

  private async initializeDocuments(): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true })

    await Promise.all(
      (['tasks', 'journals', 'settings'] as const).map(async (key) => {
        const filePath = this.getFilePath(key)
        try {
          await stat(filePath)
        } catch {
          const initialValue = this.getDefaultDocument(key)
          await this.writeDocumentAtomic(key, initialValue)
        }
      })
    )
  }

  private getFilePath(key: DocumentKey): string {
    return join(this.dataDirectory, FILE_NAMES[key])
  }

  private getDefaultDocument<K extends DocumentKey>(key: K): DocumentMap[K] {
    if (key === 'tasks') {
      return clone(DEFAULT_TASK_DOCUMENT) as DocumentMap[K]
    }

    if (key === 'journals') {
      return clone(DEFAULT_JOURNAL_DOCUMENT) as DocumentMap[K]
    }

    return createDefaultSettings(this.dataDirectory) as DocumentMap[K]
  }

  private parseDocument<K extends DocumentKey>(key: K, content: string): DocumentMap[K] {
    const parsed = JSON.parse(content) as DocumentMap[K]
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid document payload for ${key}.`)
    }

    return parsed
  }

  private async writeDocumentAtomic<K extends DocumentKey>(key: K, data: DocumentMap[K]): Promise<void> {
    const filePath = this.getFilePath(key)
    const tempPath = `${filePath}.tmp`
    const backupPath = `${filePath}.bak`

    await mkdir(dirname(filePath), { recursive: true })

    try {
      await stat(filePath)
      await cp(filePath, backupPath, { force: true })
    } catch {
      // Ignore files that do not exist yet.
    }

    try {
      await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
      await rename(tempPath, filePath)
    } catch (error) {
      try {
        await cp(backupPath, filePath, { force: true })
      } catch {
        // Ignore restore failures and bubble the root error.
      }

      throw error
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined)
    }
  }
}
