import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import JSZip from 'jszip'

import {
  APP_SCHEMA_VERSION,
  type AppSettings,
  type DocumentKey,
  type ExportPackageManifest,
  type ExportResult,
  type ImportMode,
  type ImportResult,
  type ImportValidationResult,
  type JournalDocument,
  type TaskDocument
} from '@shared/schema'
import { FileStorage } from '@main/storage/fileStorage'

type DocumentBundle = {
  tasks: TaskDocument
  journals: JournalDocument
  settings: AppSettings
}

const PACKAGE_VERSION = 1

const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex')

const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

const timestamp = (): string => new Date().toISOString().replace(/[:.]/g, '-')

const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const items = new Map<string, T>()
  for (const item of current) {
    items.set(item.id, item)
  }
  for (const item of incoming) {
    items.set(item.id, item)
  }
  return [...items.values()]
}

export class ImportExportService {
  constructor(
    private readonly storage: FileStorage,
    private readonly appVersion = '0.1.0'
  ) {}

  async exportSnowflakePackage(filePath: string): Promise<ExportResult> {
    const documents = await this.readDocuments()
    const manifest = this.buildManifest(documents)
    const zip = new JSZip()

    zip.file('manifest.json', serialize(manifest))
    zip.file('tasks.json', serialize(documents.tasks))
    zip.file('journals.json', serialize(documents.journals))
    zip.file('settings.json', serialize(documents.settings))

    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    await writeFile(filePath, content)

    return {
      format: 'snowflake',
      filePath,
      byteLength: content.byteLength,
      exportedAt: manifest.exportedAt
    }
  }

  async exportJsonSnapshot(filePath: string): Promise<ExportResult> {
    const documents = await this.readDocuments()
    const manifest = this.buildManifest(documents)
    const payload = {
      manifest,
      documents
    }
    const serialized = serialize(payload)
    await writeFile(filePath, serialized, 'utf-8')
    const fileStats = await stat(filePath)

    return {
      format: 'json',
      filePath,
      byteLength: fileStats.size,
      exportedAt: manifest.exportedAt
    }
  }

  async createBackupSnapshot(): Promise<ExportResult> {
    const backupsDirectory = join(this.storage.getDataDirectory(), 'backups')
    await mkdir(backupsDirectory, { recursive: true })
    const filePath = join(backupsDirectory, `snowflake-backup-${timestamp()}.snowflake`)
    return this.exportSnowflakePackage(filePath)
  }

  async importSnowflakePackage(
    filePath: string,
    mode: ImportMode,
    includeSettings: boolean
  ): Promise<ImportResult> {
    const validation = await this.validateSnowflakePackage(filePath)
    if (!validation.isValid) {
      throw new Error(validation.conflicts.join(' ') || 'Import package validation failed.')
    }

    const currentDocuments = await this.readDocuments()
    const { manifest, documents: importedDocuments } = await this.readPackage(filePath)
    const backup = await this.createBackupSnapshot()

    try {
      const nextDocuments = this.buildImportedDocuments(
        currentDocuments,
        importedDocuments,
        mode,
        includeSettings
      )
      await this.storage.replaceDocuments(nextDocuments)
    } catch (error) {
      const backupPackage = await this.readPackage(backup.filePath)
      await this.storage.replaceDocuments(backupPackage.documents)
      throw error
    }

    return {
      filePath,
      mode,
      importedDocuments: ['tasks', 'journals', ...(includeSettings ? (['settings'] as const) : [])],
      backupPath: backup.filePath,
      warnings: [
        ...validation.warnings,
        ...(manifest.schemaVersion !== APP_SCHEMA_VERSION
          ? [`Imported schema ${manifest.schemaVersion} was normalized to local schema ${APP_SCHEMA_VERSION}.`]
          : [])
      ]
    }
  }

  async validateSnowflakePackage(filePath: string): Promise<ImportValidationResult> {
    try {
      const { manifest, documents } = await this.readPackage(filePath)
      const conflicts: string[] = []
      const warnings: string[] = []

      const files: Array<[DocumentKey, string]> = [
        ['tasks', serialize(documents.tasks)],
        ['journals', serialize(documents.journals)],
        ['settings', serialize(documents.settings)]
      ]

      for (const [key, serialized] of files) {
        const expected = manifest.includedFiles.find((file) => file.fileName === key)
        if (!expected) {
          conflicts.push(`Missing manifest entry for ${key}.`)
          continue
        }
        if (expected.checksum !== sha256(serialized)) {
          conflicts.push(`Checksum mismatch for ${key}.`)
        }
      }

      const overallChecksum = sha256(
        manifest.includedFiles
          .map((file) => `${file.fileName}:${file.checksum}:${file.byteLength}`)
          .join('|')
      )
      if (manifest.checksum !== overallChecksum) {
        conflicts.push('Manifest checksum mismatch.')
      }

      if (manifest.version !== PACKAGE_VERSION) {
        warnings.push(`Package version ${manifest.version} differs from supported version ${PACKAGE_VERSION}.`)
      }

      if (manifest.schemaVersion > APP_SCHEMA_VERSION) {
        conflicts.push(`Package schema ${manifest.schemaVersion} is newer than local schema ${APP_SCHEMA_VERSION}.`)
      } else if (manifest.schemaVersion < APP_SCHEMA_VERSION) {
        warnings.push(`Package schema ${manifest.schemaVersion} will be imported into schema ${APP_SCHEMA_VERSION}.`)
      }

      return {
        isValid: conflicts.length === 0,
        version: manifest.version,
        warnings,
        conflicts
      }
    } catch (error) {
      return {
        isValid: false,
        version: null,
        warnings: [],
        conflicts: [error instanceof Error ? error.message : 'Import package validation failed.']
      }
    }
  }

  private async readDocuments(): Promise<DocumentBundle> {
    await this.storage.flushPendingWrites()
    const [tasks, journals, settings] = await Promise.all([
      this.storage.readDocument('tasks'),
      this.storage.readDocument('journals'),
      this.storage.readDocument('settings')
    ])

    return { tasks, journals, settings }
  }

  private buildManifest(documents: DocumentBundle): ExportPackageManifest {
    const exportedAt = new Date().toISOString()
    const includedFiles = (['tasks', 'journals', 'settings'] as const).map((fileName) => {
      const serialized = serialize(documents[fileName])
      return {
        fileName,
        checksum: sha256(serialized),
        byteLength: Buffer.byteLength(serialized, 'utf-8')
      }
    })

    return {
      version: PACKAGE_VERSION,
      appVersion: this.appVersion,
      schemaVersion: APP_SCHEMA_VERSION,
      exportedAt,
      includedFiles,
      checksum: sha256(
        includedFiles
          .map((file) => `${file.fileName}:${file.checksum}:${file.byteLength}`)
          .join('|')
      )
    }
  }

  private async readPackage(filePath: string): Promise<{
    manifest: ExportPackageManifest
    documents: DocumentBundle
  }> {
    const content = await readFile(filePath)
    const zip = await JSZip.loadAsync(content)
    const manifestContent = await zip.file('manifest.json')?.async('string')
    const tasksContent = await zip.file('tasks.json')?.async('string')
    const journalsContent = await zip.file('journals.json')?.async('string')
    const settingsContent = await zip.file('settings.json')?.async('string')

    if (!manifestContent || !tasksContent || !journalsContent || !settingsContent) {
      throw new Error('Import package is missing required files.')
    }

    return {
      manifest: JSON.parse(manifestContent) as ExportPackageManifest,
      documents: {
        tasks: JSON.parse(tasksContent) as TaskDocument,
        journals: JSON.parse(journalsContent) as JournalDocument,
        settings: JSON.parse(settingsContent) as AppSettings
      }
    }
  }

  private buildImportedDocuments(
    currentDocuments: DocumentBundle,
    importedDocuments: DocumentBundle,
    mode: ImportMode,
    includeSettings: boolean
  ): DocumentBundle {
    if (mode === 'overwrite') {
      return {
        tasks: importedDocuments.tasks,
        journals: importedDocuments.journals,
        settings: includeSettings
          ? this.normalizeImportedSettings(currentDocuments.settings, importedDocuments.settings)
          : currentDocuments.settings
      }
    }

    return {
      tasks: {
        version: Math.max(currentDocuments.tasks.version, importedDocuments.tasks.version),
        tasks: mergeById(currentDocuments.tasks.tasks, importedDocuments.tasks.tasks).sort((left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
        ),
        categories: mergeById(currentDocuments.tasks.categories, importedDocuments.tasks.categories),
        timeLogs: mergeById(currentDocuments.tasks.timeLogs, importedDocuments.tasks.timeLogs).sort(
          (left, right) => Date.parse(right.startAt) - Date.parse(left.startAt)
        )
      },
      journals: {
        version: Math.max(currentDocuments.journals.version, importedDocuments.journals.version),
        entries: mergeById(currentDocuments.journals.entries, importedDocuments.journals.entries).sort(
          (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
        ),
        templates: mergeById(currentDocuments.journals.templates, importedDocuments.journals.templates)
      },
      settings: includeSettings
        ? this.normalizeImportedSettings(currentDocuments.settings, {
            ...currentDocuments.settings,
            ...importedDocuments.settings
          })
        : currentDocuments.settings
    }
  }

  private normalizeImportedSettings(currentSettings: AppSettings, importedSettings: AppSettings): AppSettings {
    return {
      ...currentSettings,
      ...importedSettings,
      version: APP_SCHEMA_VERSION,
      storagePath: this.storage.getDataDirectory(),
      updatedAt: new Date().toISOString()
    }
  }
}
