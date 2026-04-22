import {
  type AnalyticsJournalDetail,
  type AnalyticsQueryInput,
  type AnalyticsSnapshot,
  type AnalyticsTaskDetail,
  type CategoryStat,
  type DailySummary,
  type EfficiencyRecord,
  type HeatmapPoint,
  type TaskCategory,
  type TimeLog
} from '@shared/schema'
import { FileStorage } from '@main/storage/fileStorage'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = 365

const parseDateKey = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error('Analytics range requires YYYY-MM-DD dates.')
  }

  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const formatDateKey = (value: Date): string => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeQuery = (input: AnalyticsQueryInput): AnalyticsQueryInput => {
  const start = parseDateKey(input.startDate)
  const end = parseDateKey(input.endDate)

  if (start.getTime() > end.getTime()) {
    throw new Error('Analytics startDate must be earlier than endDate.')
  }

  const spanDays = Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY) + 1
  if (spanDays > MAX_RANGE_DAYS) {
    throw new Error('Analytics range cannot exceed 365 days.')
  }

  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end)
  }
}

const isDateInRange = (dateKey: string, range: AnalyticsQueryInput): boolean =>
  dateKey >= range.startDate && dateKey <= range.endDate

const buildDateKeys = (range: AnalyticsQueryInput): string[] => {
  const dates: string[] = []
  const cursor = parseDateKey(range.startDate)
  const end = parseDateKey(range.endDate)

  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

const getLogDuration = (timeLog: TimeLog): number => {
  if (timeLog.endAt !== null) {
    return timeLog.durationMinutes
  }

  const startMs = Date.parse(timeLog.startAt)
  const endMs = Date.now()
  return Number.isFinite(startMs) ? Math.max(0, Math.round((endMs - startMs) / 60000)) : 0
}

const getLogDateKey = (timeLog: TimeLog): string => {
  const referenceTime = timeLog.endAt ?? new Date().toISOString()
  return formatDateKey(new Date(referenceTime))
}

export class AnalyticsService {
  constructor(private readonly storage: FileStorage) {}

  async getSnapshot(input: AnalyticsQueryInput): Promise<AnalyticsSnapshot> {
    const range = normalizeQuery(input)
    const [taskDocument, journalDocument] = await Promise.all([
      this.storage.readDocument('tasks'),
      this.storage.readDocument('journals')
    ])

    const dateKeys = buildDateKeys(range)
    const categoryMap = new Map<string, TaskCategory>(taskDocument.categories.map((category) => [category.id, category]))
    const categoryMinutesMap = new Map<string, number>()
    const categoryTaskCountMap = new Map<string, number>()
    const completedTaskCountByDate = new Map<string, number>()
    const createdTaskCountByDate = new Map<string, number>()
    const journalCountByDate = new Map<string, number>()
    const dailyCategoryBreakdown = new Map<string, Map<string, number>>()
    const taskHeatmap = new Map<string, number>()
    const journalHeatmap = new Map<string, number>()

    const rangedTimeLogs = taskDocument.timeLogs.filter((timeLog) => isDateInRange(getLogDateKey(timeLog), range))
    for (const timeLog of rangedTimeLogs) {
      const durationMinutes = getLogDuration(timeLog)
      const logDateKey = getLogDateKey(timeLog)
      const task = taskDocument.tasks.find((item) => item.id === timeLog.taskId)
      if (!task) {
        continue
      }

      categoryMinutesMap.set(task.categoryId, (categoryMinutesMap.get(task.categoryId) ?? 0) + durationMinutes)
      const breakdown = dailyCategoryBreakdown.get(logDateKey) ?? new Map<string, number>()
      breakdown.set(task.categoryId, (breakdown.get(task.categoryId) ?? 0) + durationMinutes)
      dailyCategoryBreakdown.set(logDateKey, breakdown)
    }

    const rangedTasks = taskDocument.tasks.filter((task) => {
      const createdDate = formatDateKey(new Date(task.createdAt))
      const completedDate = task.completedAt ? formatDateKey(new Date(task.completedAt)) : null
      return isDateInRange(createdDate, range) || (completedDate ? isDateInRange(completedDate, range) : false)
    })

    const completedTaskDetails: AnalyticsTaskDetail[] = []
    const efficiencyRecords: EfficiencyRecord[] = []

    for (const task of rangedTasks) {
      const createdDate = formatDateKey(new Date(task.createdAt))
      if (isDateInRange(createdDate, range)) {
        createdTaskCountByDate.set(createdDate, (createdTaskCountByDate.get(createdDate) ?? 0) + 1)
      }

      if (task.completedAt) {
        const completedDate = formatDateKey(new Date(task.completedAt))
        if (isDateInRange(completedDate, range)) {
          completedTaskCountByDate.set(completedDate, (completedTaskCountByDate.get(completedDate) ?? 0) + 1)
          taskHeatmap.set(completedDate, (taskHeatmap.get(completedDate) ?? 0) + 1)
          categoryTaskCountMap.set(task.categoryId, (categoryTaskCountMap.get(task.categoryId) ?? 0) + 1)

          const categoryName = categoryMap.get(task.categoryId)?.name ?? '未分类'
          completedTaskDetails.push({
            taskId: task.id,
            title: task.title,
            categoryId: task.categoryId,
            categoryName,
            completedAt: task.completedAt,
            actualMinutes: task.actualMinutes,
            estimatedMinutes: task.estimatedMinutes,
            status: task.status
          })

          if (task.estimatedMinutes > 0) {
            const ratio = task.actualMinutes / task.estimatedMinutes
            efficiencyRecords.push({
              taskId: task.id,
              taskTitle: task.title,
              categoryId: task.categoryId,
              categoryName,
              estimatedMinutes: task.estimatedMinutes,
              actualMinutes: task.actualMinutes,
              ratio: Number(ratio.toFixed(2)),
              isOvertime: ratio > 1.5,
              completedAt: task.completedAt
            })
          }
        }
      }
    }

    const journalDetails: AnalyticsJournalDetail[] = journalDocument.entries
      .filter((entry) => !entry.isDeleted && isDateInRange(entry.date, range))
      .map((entry) => {
        journalCountByDate.set(entry.date, (journalCountByDate.get(entry.date) ?? 0) + 1)
        journalHeatmap.set(entry.date, (journalHeatmap.get(entry.date) ?? 0) + 1)

        return {
          entryId: entry.id,
          title: entry.title,
          date: entry.date,
          entryType: entry.entryType
        }
      })
      .sort((left, right) => right.date.localeCompare(left.date))

    const dailySummaries: DailySummary[] = dateKeys.map((dateKey) => {
      const categoryBreakdownMap = dailyCategoryBreakdown.get(dateKey) ?? new Map<string, number>()
      const categoryBreakdown = [...categoryBreakdownMap.entries()]
        .map(([categoryId, totalMinutes]) => ({
          categoryId,
          categoryName: categoryMap.get(categoryId)?.name ?? '未分类',
          totalMinutes
        }))
        .sort((left, right) => right.totalMinutes - left.totalMinutes)

      return {
        date: dateKey,
        totalTasks: createdTaskCountByDate.get(dateKey) ?? 0,
        completedTasks: completedTaskCountByDate.get(dateKey) ?? 0,
        totalMinutes: categoryBreakdown.reduce((sum, item) => sum + item.totalMinutes, 0),
        categoryBreakdown
      }
    })

    const categoryStats: CategoryStat[] = [...categoryMap.values()]
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        totalMinutes: categoryMinutesMap.get(category.id) ?? 0,
        taskCount: categoryTaskCountMap.get(category.id) ?? 0,
        period: `${range.startDate} ~ ${range.endDate}`
      }))
      .filter((item) => item.totalMinutes > 0 || item.taskCount > 0)
      .sort((left, right) => right.totalMinutes - left.totalMinutes)

    const heatmapPoints: HeatmapPoint[] = [
      ...dateKeys.map((date) => ({
        date,
        value: taskHeatmap.get(date) ?? 0,
        type: 'task' as const
      })),
      ...dateKeys.map((date) => ({
        date,
        value: journalHeatmap.get(date) ?? 0,
        type: 'journal' as const
      }))
    ]

    const totalFocusMinutes = dailySummaries.reduce((sum, item) => sum + item.totalMinutes, 0)
    const completedTaskCount = completedTaskDetails.length
    const totalJournalEntries = journalDetails.length

    return {
      range,
      completedTaskCount,
      totalFocusMinutes,
      totalJournalEntries,
      topCategory: categoryStats[0] ?? null,
      dailySummaries,
      categoryStats,
      efficiencyRecords: efficiencyRecords.sort((left, right) => right.ratio - left.ratio),
      heatmapPoints,
      taskDetails: completedTaskDetails.sort((left, right) =>
        Date.parse(right.completedAt ?? '') - Date.parse(left.completedAt ?? '')
      ),
      journalDetails
    }
  }
}
