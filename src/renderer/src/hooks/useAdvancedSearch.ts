import { useCallback, useMemo, useState } from 'react'

import type {
  AdvancedSearchQuery,
  JournalEntry,
  JournalEntryType,
  TaskPriority,
  TaskRecord,
  TaskStatus
} from '@shared/schema'

/**
 * 高级搜索过滤器接口
 * 定义所有可用的搜索过滤条件
 */
export interface AdvancedSearchFilter {
  keyword: string
  searchInTitle: boolean
  searchInDescription: boolean
  searchInContent: boolean
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  categories: string[]
  entryTypes: JournalEntryType[]
  startDate: string
  endDate: string
  exactMatch: boolean
}

/**
 * 默认搜索过滤器
 * 默认在标题和描述中搜索，不启用精确匹配
 */
const defaultFilter: AdvancedSearchFilter = {
  keyword: '',
  searchInTitle: true,
  searchInDescription: true,
  searchInContent: true,
  statuses: [],
  priorities: [],
  categories: [],
  entryTypes: [],
  startDate: '',
  endDate: '',
  exactMatch: false
}

/**
 * 高级搜索Hook
 * 提供多条件组合搜索功能，支持任务和日记的过滤
 * 包含关键词搜索、状态过滤、优先级过滤、日期范围筛选等
 */
export function useAdvancedSearch(): {
  filter: AdvancedSearchFilter
  updateFilter: (updates: Partial<AdvancedSearchFilter>) => void
  resetFilter: () => void
  toQuery: () => AdvancedSearchQuery
  filterTasks: (tasks: TaskRecord[]) => TaskRecord[]
  filterJournals: (journals: JournalEntry[]) => JournalEntry[]
  isActive: boolean
} {
  const [filter, setFilter] = useState<AdvancedSearchFilter>(defaultFilter)

  /**
   * 更新搜索过滤器
   * 使用部分更新，只修改指定的字段
   * @param updates - 要更新的字段和值
   */
  const updateFilter = useCallback((updates: Partial<AdvancedSearchFilter>): void => {
    setFilter((current) => ({
      ...current,
      ...updates
    }))
  }, [])

  /**
   * 重置搜索过滤器为默认值
   */
  const resetFilter = useCallback((): void => {
    setFilter(defaultFilter)
  }, [])

  /**
   * 转换为API查询格式
   * 将空数组和空字符串转换为undefined，便于API处理
   * @returns 适用于API调用的查询对象
   */
  const toQuery = useCallback((): AdvancedSearchQuery => {
    return {
      keyword: filter.keyword,
      searchInTitle: filter.searchInTitle,
      searchInDescription: filter.searchInDescription,
      searchInContent: filter.searchInContent,
      statuses: filter.statuses.length > 0 ? filter.statuses : undefined,
      priorities: filter.priorities.length > 0 ? filter.priorities : undefined,
      categories: filter.categories.length > 0 ? filter.categories : undefined,
      entryTypes: filter.entryTypes.length > 0 ? filter.entryTypes : undefined,
      startDate: filter.startDate || undefined,
      endDate: filter.endDate || undefined,
      exactMatch: filter.exactMatch
    }
  }, [filter])

  /**
   * 检查文本是否匹配关键词
   * @param text - 要搜索的文本
   * @param keyword - 搜索关键词
   * @param exactMatch - 是否精确匹配
   * @returns 是否匹配
   */
  const matchesKeyword = useCallback((text: string, keyword: string, exactMatch: boolean): boolean => {
    if (!keyword) {
      return true
    }

    const searchText = text.toLowerCase()
    const searchKeyword = keyword.toLowerCase()

    if (exactMatch) {
      return searchText === searchKeyword
    }

    return searchText.includes(searchKeyword)
  }, [])

  /**
   * 检查日期是否在指定范围内
   * @param date - 要检查的日期
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 是否在范围内
   */
  const matchesDateRange = useCallback((date: string | null, startDate: string, endDate: string): boolean => {
    if (!date) {
      return true
    }

    if (startDate && date < startDate) {
      return false
    }

    if (endDate && date > endDate) {
      return false
    }

    return true
  }, [])

  /**
   * 过滤任务列表
   * 根据当前搜索过滤器筛选任务
   * @param tasks - 原始任务列表
   * @returns 符合条件的任务列表
   */
  const filterTasks = useCallback(
    (tasks: TaskRecord[]): TaskRecord[] => {
      if (!filter.keyword && filter.statuses.length === 0 && filter.priorities.length === 0 && filter.categories.length === 0 && !filter.startDate && !filter.endDate) {
        return tasks
      }

      return tasks.filter((task) => {
        if (filter.keyword) {
          const titleMatch = filter.searchInTitle && matchesKeyword(task.title, filter.keyword, filter.exactMatch)
          const descMatch = filter.searchInDescription && matchesKeyword(task.description, filter.keyword, filter.exactMatch)
          if (!titleMatch && !descMatch) {
            return false
          }
        }

        if (filter.statuses.length > 0 && !filter.statuses.includes(task.status)) {
          return false
        }

        if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) {
          return false
        }

        if (filter.categories.length > 0 && !filter.categories.includes(task.categoryId)) {
          return false
        }

        if (!matchesDateRange(task.dueDate, filter.startDate, filter.endDate)) {
          return false
        }

        return true
      })
    },
    [filter, matchesKeyword, matchesDateRange]
  )

  /**
   * 过滤日记列表
   * 根据当前搜索过滤器筛选日记
   * @param journals - 原始日记列表
   * @returns 符合条件的日记列表
   */
  const filterJournals = useCallback(
    (journals: JournalEntry[]): JournalEntry[] => {
      if (!filter.keyword && filter.entryTypes.length === 0 && !filter.startDate && !filter.endDate) {
        return journals
      }

      return journals.filter((journal) => {
        if (filter.keyword) {
          const titleMatch = filter.searchInTitle && matchesKeyword(journal.title, filter.keyword, filter.exactMatch)
          const contentMatch = filter.searchInContent && matchesKeyword(journal.content, filter.keyword, filter.exactMatch)
          if (!titleMatch && !contentMatch) {
            return false
          }
        }

        if (filter.entryTypes.length > 0 && !filter.entryTypes.includes(journal.entryType)) {
          return false
        }

        if (!matchesDateRange(journal.date, filter.startDate, filter.endDate)) {
          return false
        }

        return true
      })
    },
    [filter, matchesKeyword, matchesDateRange]
  )

  /**
   * 检查搜索过滤器是否处于活动状态
   * 即是否有任何过滤条件被设置
   * @returns 是否有活跃的过滤条件
   */
  const isActive = useMemo(() => {
    return (
      filter.keyword !== '' ||
      filter.statuses.length > 0 ||
      filter.priorities.length > 0 ||
      filter.categories.length > 0 ||
      filter.entryTypes.length > 0 ||
      filter.startDate !== '' ||
      filter.endDate !== ''
    )
  }, [filter])

  return {
    filter,
    updateFilter,
    resetFilter,
    toQuery,
    filterTasks,
    filterJournals,
    isActive
  }
}
