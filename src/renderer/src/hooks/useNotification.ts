import { useCallback } from 'react'

import type { NotificationOptions, NotificationType } from '@shared/schema'
import { getDesktopApi } from '@renderer/desktopApi'

export function useNotification(): {
  showNotification: (options: NotificationOptions) => Promise<boolean>
  notifyTaskCompleted: (title: string) => Promise<boolean>
  notifyTaskDue: (title: string, dueDate: string) => Promise<boolean>
  notifyTimerComplete: (title: string, minutes: number) => Promise<boolean>
  notifySuccess: (message: string) => Promise<boolean>
  notifyError: (message: string) => Promise<boolean>
} {
  const showNotification = useCallback(async (options: NotificationOptions): Promise<boolean> => {
    try {
      const api = getDesktopApi()
      const result = await api.showNotification(options)
      return result.success
    } catch (error) {
      console.error('Failed to show notification:', error)
      return false
    }
  }, [])

  const notifyTaskCompleted = useCallback(async (title: string): Promise<boolean> => {
    return showNotification({
      type: 'task_completed',
      title: '任务已完成',
      body: `任务 "${title}" 已标记为完成`,
      urgency: 'low'
    })
  }, [showNotification])

  const notifyTaskDue = useCallback(async (title: string, dueDate: string): Promise<boolean> => {
    return showNotification({
      type: 'task_due',
      title: '任务即将到期',
      body: `任务 "${title}" 将于 ${dueDate} 到期`,
      urgency: 'normal'
    })
  }, [showNotification])

  const notifyTimerComplete = useCallback(async (title: string, minutes: number): Promise<boolean> => {
    return showNotification({
      type: 'timer_complete',
      title: '计时已完成',
      body: `专注 "${title}" ${minutes} 分钟，继续加油！`,
      urgency: 'normal'
    })
  }, [showNotification])

  const notifySuccess = useCallback(async (message: string): Promise<boolean> => {
    return showNotification({
      type: 'success',
      title: '操作成功',
      body: message,
      urgency: 'low'
    })
  }, [showNotification])

  const notifyError = useCallback(async (message: string): Promise<boolean> => {
    return showNotification({
      type: 'error',
      title: '操作失败',
      body: message,
      urgency: 'critical'
    })
  }, [showNotification])

  return {
    showNotification,
    notifyTaskCompleted,
    notifyTaskDue,
    notifyTimerComplete,
    notifySuccess,
    notifyError
  }
}
