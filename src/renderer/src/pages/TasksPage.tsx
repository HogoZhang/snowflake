import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'

import type {
  TaskCategory,
  TaskDocument,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TimeLog,
  UpdateTaskInput
} from '@shared/schema'
import { Badge, Button, Card, Input, Select, Textarea } from '@renderer/components/ui'
import { getDesktopApi } from '@renderer/desktopApi'
import { useAdvancedSearch } from '@renderer/hooks/useAdvancedSearch'

type StatusFilter = 'all' | TaskStatus

const statusGroups: Array<{ title: string; statuses: TaskStatus[] }> = [
  { title: '进行中 / 待办', statuses: ['in_progress', 'todo'] },
  { title: '已完成', statuses: ['done'] },
  { title: '已归档', statuses: ['archived'] }
]

const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: 'high', label: '高优先级' },
  { value: 'medium', label: '中优先级' },
  { value: 'low', label: '低优先级' }
]

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部任务' },
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'archived', label: '已归档' }
]

const priorityLabelMap: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低'
}

function calculateDurationMinutes(startAt: string, endAt: string): number {
  const startMs = Date.parse(startAt)
  const endMs = Date.parse(endAt)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 0
  }

  return Math.max(0, Math.round((endMs - startMs) / 60000))
}

function formatMinutesLabel(minutes: number): string {
  return `${minutes} 分钟`
}

function formatRunningDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

interface TasksPageProps {
  onNotifySuccess?: (message: string) => void
  onNotifyError?: (message: string) => void
}

export function TasksPage({
  onNotifySuccess,
  onNotifyError
}: TasksPageProps): ReactElement {
  const [document, setDocument] = useState<TaskDocument | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [estimatedMinutes, setEstimatedMinutes] = useState(30)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [checklistInput, setChecklistInput] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const advancedSearch = useAdvancedSearch()

  const notifySuccess = (message: string): void => {
    setFeedback(message)
    if (onNotifySuccess) {
      void onNotifySuccess(message)
    }
  }

  const notifyError = (message: string): void => {
    setError(message)
    if (onNotifyError) {
      void onNotifyError(message)
    }
  }

  const selectedTask = useMemo(
    () => document?.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [document, selectedTaskId]
  )

  useEffect(() => {
    const loadTasks = async (): Promise<void> => {
      try {
        const nextDocument = await getDesktopApi().getTaskDocument()
        setDocument(nextDocument)
        setSelectedTaskId(nextDocument.tasks[0]?.id ?? null)
        setCategoryId(nextDocument.categories[0]?.id ?? '')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load tasks.')
      }
    }

    void loadTasks()
  }, [])

  useEffect(() => {
    if (!document || categoryId) {
      return
    }

    setCategoryId(document.categories[0]?.id ?? '')
  }, [categoryId, document])

  const activeTimeLog = useMemo(
    () => document?.timeLogs.find((timeLog) => timeLog.endAt === null) ?? null,
    [document]
  )

  useEffect(() => {
    if (!activeTimeLog) {
      return
    }

    setNowMs(Date.now())
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [activeTimeLog])

  const taskTimingMap = useMemo(() => {
    const nextMap = new Map<
      string,
      {
        actualMinutes: number
        activeLog: TimeLog | null
        currentSessionMs: number
        timeLogs: TimeLog[]
      }
    >()

    if (!document) {
      return nextMap
    }

    for (const task of document.tasks) {
      const timeLogs = document.timeLogs
        .filter((timeLog) => timeLog.taskId === task.id)
        .sort((left, right) => Date.parse(right.startAt) - Date.parse(left.startAt))
      const openLog = timeLogs.find((timeLog) => timeLog.endAt === null) ?? null
      const closedMinutes = timeLogs
        .filter((timeLog) => timeLog.endAt !== null)
        .reduce((sum, timeLog) => sum + timeLog.durationMinutes, 0)
      const activeMinutes = openLog ? calculateDurationMinutes(openLog.startAt, new Date(nowMs).toISOString()) : 0
      const currentSessionMs = openLog ? Math.max(0, nowMs - Date.parse(openLog.startAt)) : 0

      nextMap.set(task.id, {
        actualMinutes: closedMinutes + activeMinutes,
        activeLog: openLog,
        currentSessionMs,
        timeLogs
      })
    }

    return nextMap
  }, [document, nowMs])

  const visibleTasks = useMemo(() => {
    if (!document) {
      return []
    }

    return advancedSearch.filterTasks(document.tasks)
  }, [advancedSearch, document])

  const groupedTasks = useMemo(
    () =>
      statusGroups.map((group) => ({
        ...group,
        tasks: visibleTasks.filter((task) => group.statuses.includes(task.status))
      })),
    [visibleTasks]
  )

  const applyDocument = (nextDocument: TaskDocument, preferredTaskId?: string | null): void => {
    setDocument(nextDocument)
    const targetId = preferredTaskId ?? selectedTaskId
    const stillExists = nextDocument.tasks.some((task) => task.id === targetId)
    setSelectedTaskId(stillExists ? targetId : nextDocument.tasks[0]?.id ?? null)
    setFeedback(null)
    setError(null)
  }

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!title.trim()) {
      notifyError('请输入任务标题。')
      return
    }

    try {
      const desktopApi = getDesktopApi()
      const nextDocument = await desktopApi.createTask({
        title,
        categoryId,
        priority,
        estimatedMinutes
      })
      const createdTask = nextDocument.tasks[0]
      applyDocument(nextDocument, createdTask?.id ?? null)
      setTitle('')
      setEstimatedMinutes(30)
      setPriority('medium')
      notifySuccess('任务已创建。')
      void desktopApi.logInfo('Tasks', 'Task created', { taskId: createdTask?.id, title })
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Failed to create task.'
      notifyError(message)
      void getDesktopApi().logError('Tasks', 'Failed to create task', { error: message })
    }
  }

  const handleTaskMutation = async (
    taskId: string,
    input: UpdateTaskInput,
    successMessage?: string
  ): Promise<void> => {
    try {
      const desktopApi = getDesktopApi()
      const nextDocument = await desktopApi.updateTask(taskId, input)
      applyDocument(nextDocument, taskId)
      if (successMessage) {
        notifySuccess(successMessage)
      }
      void desktopApi.logInfo('Tasks', 'Task updated', { taskId, input })
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'Failed to update task.'
      notifyError(message)
      void getDesktopApi().logError('Tasks', 'Failed to update task', { taskId, error: message })
    }
  }

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    try {
      const desktopApi = getDesktopApi()
      const nextDocument = await desktopApi.removeTask(taskId)
      applyDocument(nextDocument, null)
      notifySuccess('任务已删除。')
      void desktopApi.logInfo('Tasks', 'Task deleted', { taskId })
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : 'Failed to remove task.'
      notifyError(message)
      void getDesktopApi().logError('Tasks', 'Failed to delete task', { taskId, error: message })
    }
  }

  const handleChecklistCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!selectedTask || !checklistInput.trim()) {
      return
    }

    try {
      const desktopApi = getDesktopApi()
      const nextDocument = await desktopApi.addChecklistItem(selectedTask.id, {
        content: checklistInput
      })
      applyDocument(nextDocument, selectedTask.id)
      setChecklistInput('')
      void desktopApi.logInfo('Tasks', 'Checklist item added', { taskId: selectedTask.id })
    } catch (checklistError) {
      const message = checklistError instanceof Error ? checklistError.message : 'Failed to add checklist item.'
      notifyError(message)
      void getDesktopApi().logError('Tasks', 'Failed to add checklist item', { error: message })
    }
  }

  if (!document) {
    return <Card className="list-card">Loading tasks...</Card>
  }

  return (
    <section className="tasks-page">
      <header className="tasks-header">
        <div className="analytics-orb analytics-orb-left" />
        <div className="analytics-orb analytics-orb-right" />
        <div className="tasks-header-content">
          <h3 className="tasks-title">
            任务管理
            <span className="analytics-title-emoji" aria-hidden="true">
              📝
            </span>
          </h3>
          <p className="tasks-subtitle">专注当下，一步一步完成你的目标。</p>
        </div>
      </header>

      <form className="task-create-form" onSubmit={handleCreateTask}>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="task-title-input"
          placeholder="添加新任务..."
        />
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {document.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          min={5}
          step={5}
          value={estimatedMinutes}
          className="task-minutes-input"
          onChange={(event) => setEstimatedMinutes(Number.parseInt(event.target.value, 10) || 30)}
        />
        <span className="task-minutes-unit">分钟</span>
        <Button className="task-create-button" type="submit">
          新建
        </Button>
      </form>

      <section className="task-toolbar">
        <div className="task-chip-row">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                (option.value === 'all' && advancedSearch.filter.statuses.length === 0) ||
                (option.value !== 'all' && advancedSearch.filter.statuses.includes(option.value as TaskStatus))
                  ? 'task-chip active'
                  : 'task-chip'
              }
              onClick={() => {
                if (option.value === 'all') {
                  advancedSearch.updateFilter({ statuses: [] })
                } else {
                  const isActive = advancedSearch.filter.statuses.includes(option.value as TaskStatus)
                  advancedSearch.updateFilter({
                    statuses: isActive
                      ? advancedSearch.filter.statuses.filter((s) => s !== option.value)
                      : [option.value as TaskStatus]
                  })
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="task-filter-row">
          <Select
            value={advancedSearch.filter.categories.length > 0 ? advancedSearch.filter.categories[0] : 'all'}
            onChange={(event) => {
              const value = event.target.value
              advancedSearch.updateFilter({
                categories: value === 'all' ? [] : [value]
              })
            }}
          >
            <option value="all">全部分类</option>
            {document.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Input
            type="search"
            placeholder="搜索标题或描述"
            value={advancedSearch.filter.keyword}
            onChange={(event) => advancedSearch.updateFilter({ keyword: event.target.value })}
          />
          <Button
            type="button"
            variant={advancedSearch.isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            title="高级搜索"
          >
            {showAdvancedSearch ? '收起' : '高级'}
          </Button>
        </div>
      </section>

      {showAdvancedSearch ? (
        <Card className="advanced-search-panel">
          <div className="advanced-search-row">
            <div className="field">
              <span>搜索范围</span>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={advancedSearch.filter.searchInTitle}
                  onChange={(event) => advancedSearch.updateFilter({ searchInTitle: event.target.checked })}
                />
                <span>标题</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={advancedSearch.filter.searchInDescription}
                  onChange={(event) => advancedSearch.updateFilter({ searchInDescription: event.target.checked })}
                />
                <span>描述</span>
              </label>
            </div>
            <div className="field">
              <span>优先级</span>
              {priorityOptions.map((option) => (
                <label key={option.value} className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={advancedSearch.filter.priorities.includes(option.value)}
                    onChange={(event) => {
                      const isChecked = event.target.checked
                      const current = advancedSearch.filter.priorities
                      advancedSearch.updateFilter({
                        priorities: isChecked ? [...current, option.value] : current.filter((p) => p !== option.value)
                      })
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="advanced-search-row">
            <div className="field">
              <span>开始日期</span>
              <Input
                type="date"
                value={advancedSearch.filter.startDate}
                onChange={(event) => advancedSearch.updateFilter({ startDate: event.target.value })}
              />
            </div>
            <div className="field">
              <span>结束日期</span>
              <Input
                type="date"
                value={advancedSearch.filter.endDate}
                onChange={(event) => advancedSearch.updateFilter({ endDate: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={advancedSearch.filter.exactMatch}
                  onChange={(event) => advancedSearch.updateFilter({ exactMatch: event.target.checked })}
                />
                <span>精确匹配</span>
              </label>
            </div>
          </div>
          {advancedSearch.isActive ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => advancedSearch.resetFilter()}>
              清除筛选
            </Button>
          ) : null}
        </Card>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}
      {feedback ? <div className="task-feedback">{feedback}</div> : null}

      <div className="tasks-layout">
        <div className="tasks-board">
          {groupedTasks.map((group) =>
            group.tasks.length > 0 ? (
              <section key={group.title} className="task-group">
                <div className="task-group-header">
                  <div className="task-group-bar" />
                  <h4>{group.title}</h4>
                  <div className="task-group-line" />
                </div>

                <div className="task-list">
                  {group.tasks.map((task) => {
                    const timing = taskTimingMap.get(task.id)
                    return (
                      <TaskCard
                        key={task.id}
                        actualMinutes={timing?.actualMinutes ?? task.actualMinutes}
                        category={document.categories.find((category) => category.id === task.categoryId) ?? null}
                        currentSessionLabel={
                          timing?.activeLog ? formatRunningDuration(timing.currentSessionMs) : null
                        }
                        isSelected={selectedTaskId === task.id}
                        task={task}
                        onSelect={() => setSelectedTaskId(task.id)}
                        onPrimaryAction={() =>
                          handleTaskMutation(task.id, {
                            status: task.status === 'in_progress' ? 'todo' : 'in_progress'
                          })
                        }
                        onDone={() => handleTaskMutation(task.id, { status: 'done' }, '任务已完成。')}
                        onArchive={() => handleTaskMutation(task.id, { status: 'archived' }, '任务已归档。')}
                      />
                    )
                  })}
                </div>
              </section>
            ) : null
          )}
        </div>

        <aside className="task-detail-panel">
          {selectedTask ? (
            <TaskDetailPanel
              category={document.categories.find((category) => category.id === selectedTask.categoryId) ?? null}
              categories={document.categories}
              checklistInput={checklistInput}
              actualMinutes={taskTimingMap.get(selectedTask.id)?.actualMinutes ?? selectedTask.actualMinutes}
              currentSessionLabel={
                taskTimingMap.get(selectedTask.id)?.activeLog
                  ? formatRunningDuration(taskTimingMap.get(selectedTask.id)?.currentSessionMs ?? 0)
                  : null
              }
              timeLogs={taskTimingMap.get(selectedTask.id)?.timeLogs ?? []}
              onChecklistInputChange={setChecklistInput}
              onChecklistSubmit={handleChecklistCreate}
              onDelete={() => handleDeleteTask(selectedTask.id)}
              onDone={() => handleTaskMutation(selectedTask.id, { status: 'done' }, '任务已完成。')}
              onFieldChange={(input) => handleTaskMutation(selectedTask.id, input)}
              onToggleTimer={() =>
                handleTaskMutation(selectedTask.id, {
                  status: selectedTask.status === 'in_progress' ? 'todo' : 'in_progress'
                })
              }
              onRemoveChecklistItem={(checklistItemId) =>
                getDesktopApi()
                  .removeChecklistItem(selectedTask.id, checklistItemId)
                  .then((nextDocument) => applyDocument(nextDocument, selectedTask.id))
                  .catch((removeError) =>
                    setError(
                      removeError instanceof Error ? removeError.message : 'Failed to remove checklist item.'
                    )
                  )
              }
              onToggleChecklistItem={(checklistItemId) =>
                getDesktopApi()
                  .toggleChecklistItem(selectedTask.id, checklistItemId)
                  .then((nextDocument) => applyDocument(nextDocument, selectedTask.id))
                  .catch((toggleError) =>
                    setError(
                      toggleError instanceof Error ? toggleError.message : 'Failed to toggle checklist item.'
                    )
                  )
              }
              task={selectedTask}
            />
          ) : (
            <div className="task-empty-state">
              <p className="eyebrow">Task Detail</p>
              <h4>选择一个任务查看详情</h4>
              <p className="muted">创建新任务后，这里可以编辑描述、分类、截止日期和 checklist。</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function TaskCard({
  actualMinutes,
  category,
  currentSessionLabel,
  isSelected,
  task,
  onSelect,
  onPrimaryAction,
  onDone,
  onArchive
}: {
  actualMinutes: number
  category: TaskCategory | null
  currentSessionLabel: string | null
  isSelected: boolean
  task: TaskRecord
  onSelect: () => void
  onPrimaryAction: () => void
  onDone: () => void
  onArchive: () => void
}): ReactElement {
  const checkedCount = task.checklist.filter((item) => item.isChecked).length
  const checklistSummary = task.checklist.length > 0 ? `${checkedCount}/${task.checklist.length}` : '无'

  return (
    <article
      className={task.status === 'in_progress' ? 'task-card task-card-active' : 'task-card'}
      data-selected={isSelected}
      onClick={onSelect}
    >
      <div className="task-card-main">
        <button
          type="button"
          className={task.status === 'in_progress' ? 'task-status-toggle active' : 'task-status-toggle'}
          onClick={(event) => {
            event.stopPropagation()
            if (task.status === 'todo' || task.status === 'in_progress') {
              onPrimaryAction()
            }
          }}
          disabled={task.status === 'done' || task.status === 'archived'}
        >
          {task.status === 'in_progress' ? '■' : task.status === 'done' ? '✓' : task.status === 'archived' ? '□' : '▶'}
        </button>

        <div className="task-card-copy">
          <div className="task-card-topline">
            <h5>{task.title}</h5>
            <Badge
              className={`task-priority-badge priority-${task.priority}`}
              tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'secondary' : 'success'}
            >
              {priorityLabelMap[task.priority]}
            </Badge>
          </div>
          <div className="task-card-meta">
            <span>{category?.name ?? '未分类'}</span>
            <span>预计 {task.estimatedMinutes}m</span>
            <span>累计 {actualMinutes}m</span>
            <span>Checklist {checklistSummary}</span>
            {currentSessionLabel ? <span>本次 {currentSessionLabel}</span> : null}
            {task.dueDate ? <span>截止 {task.dueDate}</span> : null}
          </div>
        </div>
      </div>

      <div className="task-card-actions">
        {(task.status === 'todo' || task.status === 'in_progress') && (
          <Button
            type="button"
            className="task-inline-action done"
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onDone()
            }}
          >
            完成
          </Button>
        )}
        {(task.status === 'todo' || task.status === 'in_progress') && (
          <Button
            type="button"
            className="task-inline-action timer"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onPrimaryAction()
            }}
          >
            {task.status === 'in_progress' ? '暂停' : '开始'}
          </Button>
        )}
        {task.status === 'done' && (
          <Button
            type="button"
            className="task-inline-action archive"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onArchive()
            }}
          >
            归档
          </Button>
        )}
      </div>
    </article>
  )
}

function TaskDetailPanel({
  actualMinutes,
  category,
  categories,
  checklistInput,
  currentSessionLabel,
  onChecklistInputChange,
  onChecklistSubmit,
  onDelete,
  onDone,
  onFieldChange,
  onRemoveChecklistItem,
  onToggleTimer,
  onToggleChecklistItem,
  timeLogs,
  task
}: {
  actualMinutes: number
  category: TaskCategory | null
  categories: TaskCategory[]
  checklistInput: string
  currentSessionLabel: string | null
  onChecklistInputChange: (value: string) => void
  onChecklistSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onDelete: () => Promise<void>
  onDone: () => Promise<void>
  onFieldChange: (input: UpdateTaskInput) => Promise<void>
  onRemoveChecklistItem: (checklistItemId: string) => void
  onToggleTimer: () => Promise<void>
  onToggleChecklistItem: (checklistItemId: string) => void
  timeLogs: TimeLog[]
  task: TaskRecord
}): ReactElement {
  const isArchived = task.status === 'archived'

  return (
    <Card className="task-detail-card">
      <div className="task-detail-header">
        <div>
          <p className="eyebrow">Task Detail</p>
          <h4>{task.title}</h4>
          <p className="muted">
            {category?.name ?? '未分类'} · 创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
        <div className="task-detail-actions">
          {(task.status === 'todo' || task.status === 'in_progress') && (
            <Button type="button" className="task-inline-action timer" variant="ghost" size="sm" onClick={() => void onToggleTimer()}>
              {task.status === 'in_progress' ? '暂停计时' : '开始计时'}
            </Button>
          )}
          {(task.status === 'todo' || task.status === 'in_progress') && (
            <Button type="button" className="task-inline-action done" variant="secondary" size="sm" onClick={() => void onDone()}>
              完成任务
            </Button>
          )}
          <Button type="button" className="task-delete-button" variant="danger" size="sm" onClick={() => void onDelete()}>
            删除
          </Button>
        </div>
      </div>

      <label className="field">
        <span>标题</span>
        <Input
          type="text"
          value={task.title}
          disabled={isArchived}
          onChange={(event) => void onFieldChange({ title: event.target.value })}
        />
      </label>

      <label className="field">
        <span>描述</span>
        <Textarea
          className="task-textarea"
          value={task.description}
          disabled={isArchived}
          onChange={(event) => void onFieldChange({ description: event.target.value })}
        />
      </label>

      <div className="task-detail-grid">
        <label className="field">
          <span>分类</span>
          <Select
            value={task.categoryId}
            disabled={isArchived}
            onChange={(event) => void onFieldChange({ categoryId: event.target.value })}
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="field">
          <span>优先级</span>
          <Select
            value={task.priority}
            disabled={isArchived}
            onChange={(event) => void onFieldChange({ priority: event.target.value as TaskPriority })}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="task-detail-grid">
        <label className="field">
          <span>预计时长</span>
          <Input
            type="number"
            min={5}
            step={5}
            value={task.estimatedMinutes}
            disabled={isArchived}
            onChange={(event) => void onFieldChange({ estimatedMinutes: Number.parseInt(event.target.value, 10) || 0 })}
          />
        </label>

        <label className="field">
          <span>截止日期</span>
          <Input
            type="date"
            value={task.dueDate ?? ''}
            disabled={isArchived}
            onChange={(event) => void onFieldChange({ dueDate: event.target.value || null })}
          />
        </label>
      </div>

      <div className="task-status-row">
        <Badge
          className={`task-status-pill status-${task.status}`}
          tone={
            task.status === 'in_progress'
              ? 'danger'
              : task.status === 'todo'
                ? 'secondary'
                : task.status === 'done'
                  ? 'success'
                  : 'neutral'
          }
        >
          {renderStatusLabel(task.status)}
        </Badge>
        <span className="muted">Checklist 完成 {task.checklist.filter((item) => item.isChecked).length}/{task.checklist.length}</span>
      </div>

      <div className="task-time-grid">
        <div className="task-time-card">
          <span className="muted">累计专注</span>
          <strong>{formatMinutesLabel(actualMinutes)}</strong>
        </div>
        <div className="task-time-card">
          <span className="muted">当前计时</span>
          <strong>{currentSessionLabel ?? '未开始'}</strong>
        </div>
      </div>

      <div className="task-checklist-card">
        <div className="task-checklist-header">
          <h5>时间日志</h5>
          <span className="muted">{timeLogs.length} 条</span>
        </div>
        <div className="task-time-log-list">
          {timeLogs.length > 0 ? (
            timeLogs.map((timeLog) => (
              <div key={timeLog.id} className="task-time-log-item">
                <div>
                  <strong>{new Date(timeLog.startAt).toLocaleString('zh-CN')}</strong>
                  <p className="muted">
                    {timeLog.endAt
                      ? `${new Date(timeLog.endAt).toLocaleString('zh-CN')} · ${timeLog.durationMinutes} 分钟`
                      : `进行中 · 已持续 ${currentSessionLabel ?? '00:00'}`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">开始一次计时后，这里会记录每段专注区间。</p>
          )}
        </div>
      </div>

      <div className="task-checklist-card">
        <div className="task-checklist-header">
          <h5>Checklist</h5>
          <span className="muted">{task.checklist.length} 项</span>
        </div>

        <form className="task-checklist-form" onSubmit={(event) => void onChecklistSubmit(event)}>
          <Input
            type="text"
            placeholder="添加子任务"
            value={checklistInput}
            disabled={isArchived}
            onChange={(event) => onChecklistInputChange(event.target.value)}
          />
          <Button type="submit" className="task-inline-action done" variant="secondary" size="sm" disabled={isArchived}>
            添加
          </Button>
        </form>

        <div className="task-checklist-list">
          {task.checklist.length > 0 ? (
            task.checklist.map((item) => (
              <div key={item.id} className="task-checklist-item">
                <label>
                  <input
                    type="checkbox"
                    checked={item.isChecked}
                    disabled={isArchived}
                    onChange={() => onToggleChecklistItem(item.id)}
                  />
                  <span className={item.isChecked ? 'checked' : ''}>{item.content}</span>
                </label>
                {!isArchived ? (
                  <button type="button" className="task-link-button" onClick={() => onRemoveChecklistItem(item.id)}>
                    删除
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="muted">还没有 checklist 项。</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function renderStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'todo':
      return '待办'
    case 'in_progress':
      return '进行中'
    case 'done':
      return '已完成'
    case 'archived':
      return '已归档'
  }
}
