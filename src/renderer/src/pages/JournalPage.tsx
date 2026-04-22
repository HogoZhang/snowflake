import { useEffect, useMemo, useState, type ReactElement } from 'react'

import type {
  JournalDocument,
  JournalEntry,
  JournalEntryType,
  JournalTaskReference,
  JournalTemplate
} from '@shared/schema'
import { Badge, Button, Card, Input, Select, Textarea } from '@renderer/components/ui'
import { getDesktopApi } from '@renderer/desktopApi'

type EntryFilter = 'all' | JournalEntryType

type JournalDraft = {
  id: string
  entryType: JournalEntryType
  date: string
  title: string
  content: string
  linkedTaskIds: string[]
  templateId: string | null
}

const formatDateKey = (value: Date): string => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayKey = (): string => formatDateKey(new Date())

const buildDraft = (entry: JournalEntry): JournalDraft => ({
  id: entry.id,
  entryType: entry.entryType,
  date: entry.date,
  title: entry.title,
  content: entry.content,
  linkedTaskIds: entry.linkedTaskIds,
  templateId: entry.templateId
})

const entrySignature = (entry: Pick<JournalEntry, 'entryType' | 'date' | 'title' | 'content' | 'linkedTaskIds' | 'templateId'>): string =>
  JSON.stringify({
    entryType: entry.entryType,
    date: entry.date,
    title: entry.title,
    content: entry.content,
    linkedTaskIds: [...entry.linkedTaskIds].sort(),
    templateId: entry.templateId
  })

const draftSignature = (draft: JournalDraft): string =>
  JSON.stringify({
    entryType: draft.entryType,
    date: draft.date,
    title: draft.title,
    content: draft.content,
    linkedTaskIds: [...draft.linkedTaskIds].sort(),
    templateId: draft.templateId
  })

const entryTypeOptions: Array<{ value: EntryFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'daily', label: '日报' },
  { value: 'note', label: '自由笔记' }
]

export function JournalPage(): ReactElement {
  const [document, setDocument] = useState<JournalDocument | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [draft, setDraft] = useState<JournalDraft | null>(null)
  const [taskReferences, setTaskReferences] = useState<JournalTaskReference[]>([])
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all')
  const [search, setSearch] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedEntry = useMemo(
    () => document?.entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [document, selectedEntryId]
  )

  useEffect(() => {
    const loadJournalState = async (): Promise<void> => {
      try {
        const nextDocument = await getDesktopApi().getJournalDocument()
        applyDocument(nextDocument)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load journals.')
      }
    }

    void loadJournalState()
  }, [])

  useEffect(() => {
    if (!selectedEntry) {
      setDraft(null)
      return
    }

    setDraft(buildDraft(selectedEntry))
  }, [selectedEntry])

  useEffect(() => {
    if (!draft || selectedEntry?.isDeleted) {
      setTaskReferences([])
      return
    }

    const loadTaskReferences = async (): Promise<void> => {
      try {
        const references = await getDesktopApi().getCompletedTaskReferencesByDate(draft.date)
        setTaskReferences(references)
      } catch {
        setTaskReferences([])
      }
    }

    void loadTaskReferences()
  }, [draft, selectedEntry?.isDeleted])

  useEffect(() => {
    if (!draft || !selectedEntry || selectedEntry.isDeleted) {
      return
    }

    if (draftSignature(draft) === entrySignature(selectedEntry)) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveDraft(draft)
    }, 700)

    return () => window.clearTimeout(timer)
  }, [draft, selectedEntry])

  const visibleEntries = useMemo(() => {
    if (!document) {
      return []
    }

    return document.entries.filter((entry) => {
      if (!showDeleted && entry.isDeleted) {
        return false
      }

      if (entryFilter !== 'all' && entry.entryType !== entryFilter) {
        return false
      }

      const keyword = search.trim().toLowerCase()
      if (!keyword) {
        return true
      }

      return (
        entry.title.toLowerCase().includes(keyword) ||
        entry.content.toLowerCase().includes(keyword) ||
        entry.date.includes(keyword)
      )
    })
  }, [document, entryFilter, search, showDeleted])

  const templates = document?.templates ?? []

  const applyDocument = (nextDocument: JournalDocument, preferredEntryId?: string | null): void => {
    setDocument(nextDocument)
    const fallbackDaily = nextDocument.entries.find((entry) => !entry.isDeleted && entry.entryType === 'daily' && entry.date === todayKey())
    const fallbackEntry = nextDocument.entries.find((entry) => !entry.isDeleted) ?? nextDocument.entries[0] ?? null
    const nextSelectedEntryId =
      (preferredEntryId && nextDocument.entries.some((entry) => entry.id === preferredEntryId) ? preferredEntryId : null) ??
      fallbackDaily?.id ??
      fallbackEntry?.id ??
      null

    setSelectedEntryId(nextSelectedEntryId)
    setError(null)
  }

  const saveDraft = async (nextDraft: JournalDraft): Promise<void> => {
    try {
      setIsSaving(true)
      const nextDocument = await getDesktopApi().upsertJournalEntry({
        id: nextDraft.id,
        entryType: nextDraft.entryType,
        date: nextDraft.date,
        title: nextDraft.title,
        content: nextDraft.content,
        linkedTaskIds: nextDraft.linkedTaskIds,
        templateId: nextDraft.templateId
      })
      const preferredEntryId =
        nextDraft.entryType === 'daily'
          ? nextDocument.entries.find(
              (entry) => !entry.isDeleted && entry.entryType === 'daily' && entry.date === nextDraft.date
            )?.id ?? nextDraft.id
          : nextDraft.id
      applyDocument(nextDocument, preferredEntryId)
      setFeedback('已自动保存。')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save journal entry.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateEntry = async (entryType: JournalEntryType): Promise<void> => {
    try {
      const nextDate = todayKey()
      const defaultTemplate = entryType === 'daily' ? templates.find((template) => template.id === 'daily-template') : null
      const nextDocument = await getDesktopApi().upsertJournalEntry({
        entryType,
        date: nextDate,
        title: entryType === 'daily' ? `${nextDate} 日报` : '新的自由笔记',
        content: defaultTemplate?.templateContent ?? '',
        linkedTaskIds: [],
        templateId: defaultTemplate?.id ?? null
      })
      const createdEntry =
        entryType === 'daily'
          ? nextDocument.entries.find((entry) => !entry.isDeleted && entry.entryType === 'daily' && entry.date === nextDate)
          : nextDocument.entries.find((entry) => !entry.isDeleted && entry.entryType === 'note' && entry.date === nextDate)
      applyDocument(nextDocument, createdEntry?.id ?? null)
      setFeedback(entryType === 'daily' ? '今日日报已准备好。' : '新的自由笔记已创建。')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create journal entry.')
    }
  }

  const handleDeleteEntry = async (): Promise<void> => {
    if (!selectedEntry) {
      return
    }

    try {
      const nextDocument = await getDesktopApi().deleteJournalEntry(selectedEntry.id)
      applyDocument(nextDocument, null)
      setFeedback('条目已移入回收状态。')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete journal entry.')
    }
  }

  const handleRestoreEntry = async (): Promise<void> => {
    if (!selectedEntry) {
      return
    }

    try {
      const nextDocument = await getDesktopApi().restoreJournalEntry(selectedEntry.id)
      applyDocument(nextDocument, selectedEntry.id)
      setFeedback('条目已恢复。')
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Failed to restore journal entry.')
    }
  }

  const handleToggleTaskLink = (taskId: string): void => {
    if (!draft) {
      return
    }

    setDraft((current) =>
      current
        ? {
            ...current,
            linkedTaskIds: current.linkedTaskIds.includes(taskId)
              ? current.linkedTaskIds.filter((id) => id !== taskId)
              : [...current.linkedTaskIds, taskId]
          }
        : current
    )
  }

  const handleTemplateChange = (templateId: string): void => {
    if (!draft) {
      return
    }

    const targetTemplate = templates.find((template) => template.id === templateId) ?? null
    setDraft((current) =>
      current
        ? {
            ...current,
            templateId: templateId || null,
            content: targetTemplate ? targetTemplate.templateContent : current.content
          }
        : current
    )
  }

  if (!document) {
    return <Card className="list-card">Loading journals...</Card>
  }

  return (
    <section className="journal-page">
      <header className="journal-header">
        <div className="analytics-orb analytics-orb-left" />
        <div className="analytics-orb analytics-orb-right" />
        <div className="journal-header-content">
          <h3 className="journal-title">日记/总结</h3>
          <p className="journal-subtitle">记录今天的完成、复盘问题，并把已完成任务沉淀成可回看的笔记。</p>
        </div>
        <div className="journal-header-actions">
          <Button type="button" variant="secondary" onClick={() => void handleCreateEntry('daily')}>
            今日日报
          </Button>
          <Button type="button" variant="ghost" onClick={() => void handleCreateEntry('note')}>
            新建笔记
          </Button>
        </div>
      </header>

      <section className="journal-toolbar">
        <div className="task-chip-row">
          {entryTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={entryFilter === option.value ? 'task-chip active' : 'task-chip'}
              onClick={() => setEntryFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="journal-toolbar-right">
          <Input
            type="search"
            placeholder="搜索标题、内容或日期"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="button" variant={showDeleted ? 'secondary' : 'ghost'} onClick={() => setShowDeleted((current) => !current)}>
            {showDeleted ? '隐藏已删除' : '显示已删除'}
          </Button>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}
      {feedback ? <div className="task-feedback">{feedback}</div> : null}

      <div className="journal-layout">
        <aside className="journal-list-panel">
          <Card className="journal-list-card">
            <div className="journal-list-header">
              <div>
                <p className="eyebrow">Entries</p>
                <h4>条目列表</h4>
              </div>
              <Badge tone="secondary">{visibleEntries.length} 条</Badge>
            </div>

            <div className="journal-entry-list">
              {visibleEntries.length > 0 ? (
                visibleEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={selectedEntryId === entry.id ? 'journal-entry-card active' : 'journal-entry-card'}
                    onClick={() => setSelectedEntryId(entry.id)}
                  >
                    <div className="journal-entry-card-top">
                      <Badge tone={entry.entryType === 'daily' ? 'primary' : 'secondary'}>
                        {entry.entryType === 'daily' ? '日报' : '笔记'}
                      </Badge>
                      {entry.isDeleted ? <Badge tone="neutral">已删除</Badge> : null}
                    </div>
                    <h5>{entry.title}</h5>
                    <p>{entry.content.trim() || '暂无正文内容。'}</p>
                    <span>{entry.date}</span>
                  </button>
                ))
              ) : (
                <div className="journal-empty-list">
                  <h5>还没有匹配的条目</h5>
                  <p className="muted">你可以先创建今天的日报，或新建一篇自由笔记。</p>
                </div>
              )}
            </div>
          </Card>
        </aside>

        <section className="journal-editor-panel">
          {selectedEntry && draft ? (
            <JournalEditor
              draft={draft}
              entry={selectedEntry}
              isSaving={isSaving}
              taskReferences={taskReferences}
              templates={templates}
              onDelete={() => void handleDeleteEntry()}
              onRestore={() => void handleRestoreEntry()}
              onTemplateChange={handleTemplateChange}
              onToggleTaskLink={handleToggleTaskLink}
              onUpdateDraft={setDraft}
            />
          ) : (
            <Card className="journal-editor-card journal-empty-editor">
              <p className="eyebrow">Journal</p>
              <h4>从今天开始记录</h4>
              <p className="muted">创建日报后，可以直接引用今天已完成的任务，也可以单独写一篇自由笔记。</p>
              <div className="journal-empty-actions">
                <Button type="button" variant="secondary" onClick={() => void handleCreateEntry('daily')}>
                  创建今日日报
                </Button>
                <Button type="button" variant="ghost" onClick={() => void handleCreateEntry('note')}>
                  新建自由笔记
                </Button>
              </div>
            </Card>
          )}
        </section>
      </div>
    </section>
  )
}

function JournalEditor({
  draft,
  entry,
  isSaving,
  taskReferences,
  templates,
  onDelete,
  onRestore,
  onTemplateChange,
  onToggleTaskLink,
  onUpdateDraft
}: {
  draft: JournalDraft
  entry: JournalEntry
  isSaving: boolean
  taskReferences: JournalTaskReference[]
  templates: JournalTemplate[]
  onDelete: () => void
  onRestore: () => void
  onTemplateChange: (templateId: string) => void
  onToggleTaskLink: (taskId: string) => void
  onUpdateDraft: (draft: JournalDraft | ((current: JournalDraft | null) => JournalDraft | null)) => void
}): ReactElement {
  const isDeleted = entry.isDeleted
  const linkedSnapshotMap = new Map(entry.linkedTasksSnapshot.map((snapshot) => [snapshot.taskId, snapshot]))

  return (
    <Card className="journal-editor-card">
      <div className="journal-editor-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h4>{draft.title || (draft.entryType === 'daily' ? `${draft.date} 日报` : '未命名笔记')}</h4>
          <p className="muted">{isSaving ? '正在保存...' : isDeleted ? '已删除，可恢复查看。' : '编辑后会自动保存到本地。'}</p>
        </div>
        <div className="journal-editor-actions">
          {isDeleted ? (
            <Button type="button" variant="secondary" onClick={onRestore}>
              恢复
            </Button>
          ) : (
            <Button type="button" variant="danger" onClick={onDelete}>
              删除
            </Button>
          )}
        </div>
      </div>

      <div className="journal-editor-grid">
        <label className="field">
          <span>类型</span>
          <Select
            value={draft.entryType}
            disabled={isDeleted}
            onChange={(event) =>
              onUpdateDraft((current) =>
                current
                  ? {
                      ...current,
                      entryType: event.target.value as JournalEntryType
                    }
                  : current
              )
            }
          >
            <option value="daily">日报</option>
            <option value="note">自由笔记</option>
          </Select>
        </label>

        <label className="field">
          <span>日期</span>
          <Input
            type="date"
            value={draft.date}
            disabled={isDeleted}
            onChange={(event) =>
              onUpdateDraft((current) =>
                current
                  ? {
                      ...current,
                      date: event.target.value
                    }
                  : current
              )
            }
          />
        </label>
      </div>

      <div className="journal-editor-grid">
        <label className="field">
          <span>标题</span>
          <Input
            type="text"
            value={draft.title}
            disabled={isDeleted}
            onChange={(event) =>
              onUpdateDraft((current) =>
                current
                  ? {
                      ...current,
                      title: event.target.value
                    }
                  : current
              )
            }
          />
        </label>

        <label className="field">
          <span>模板</span>
          <Select value={draft.templateId ?? ''} disabled={isDeleted} onChange={(event) => onTemplateChange(event.target.value)}>
            <option value="">不使用模板</option>
            {templates
              .filter((template) => draft.entryType === 'note' || template.type === 'daily' || template.type === 'weekly')
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
          </Select>
        </label>
      </div>

      <label className="field">
        <span>正文</span>
        <Textarea
          className="journal-content-textarea"
          value={draft.content}
          disabled={isDeleted}
          onChange={(event) =>
            onUpdateDraft((current) =>
              current
                ? {
                    ...current,
                    content: event.target.value
                  }
                : current
            )
          }
        />
      </label>

      <div className="journal-reference-card">
        <div className="journal-reference-header">
          <div>
            <h5>引用当日已完成任务</h5>
            <p className="muted">勾选后会把任务引用保存到当前条目，即使任务后续被删除也会保留快照。</p>
          </div>
          <Badge tone="secondary">{draft.linkedTaskIds.length} 项</Badge>
        </div>

        <div className="journal-task-reference-list">
          {taskReferences.length > 0 ? (
            taskReferences.map((task) => (
              <label key={task.taskId} className="journal-task-reference-item">
                <input
                  type="checkbox"
                  checked={draft.linkedTaskIds.includes(task.taskId)}
                  disabled={isDeleted}
                  onChange={() => onToggleTaskLink(task.taskId)}
                />
                <div>
                  <strong>{task.title}</strong>
                  <p className="muted">
                    {task.categoryName} · {task.actualMinutes} 分钟 · {new Date(task.completedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </label>
            ))
          ) : (
            <p className="muted">这一天还没有已完成任务，或者尚未加载到可引用项。</p>
          )}
        </div>

        {entry.linkedTasksSnapshot.length > 0 ? (
          <div className="journal-linked-snapshots">
            <h5>已保存的引用快照</h5>
            <div className="journal-snapshot-list">
              {entry.linkedTaskIds.map((taskId) => {
                const snapshot = linkedSnapshotMap.get(taskId)
                if (!snapshot) {
                  return null
                }

                return (
                  <div key={taskId} className="journal-snapshot-item">
                    <strong>{snapshot.title}</strong>
                    <span>{snapshot.completedAt ? new Date(snapshot.completedAt).toLocaleString('zh-CN') : '任务已不在列表中'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
