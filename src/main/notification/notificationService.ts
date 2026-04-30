import { Notification } from 'electron'

import type { NotificationOptions, NotificationResult } from '@shared/schema'

/**
 * 生成唯一ID
 * 使用时间戳和随机字符串组合，确保ID唯一性
 */
const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/**
 * 通知类型与图标映射
 * 为不同类型的通知提供对应的emoji图标，增强用户识别
 */
const notificationIcons: Record<string, string> = {
  task_due: '⚠️',
  task_completed: '✅',
  timer_complete: '⏱️',
  reminder: '🔔',
  success: '✨',
  error: '❌'
}

/**
 * 通知服务类
 * 封装Electron的Notification API，提供统一的通知发送接口
 * 支持静音模式、启用/禁用控制，以及多种预设通知类型
 */
export class NotificationService {
  /** 通知服务是否启用 */
  private enabled: boolean = true
  /** 是否启用静音模式（静音模式下通知不会播放声音） */
  private silentMode: boolean = false

  constructor() {}

  /**
   * 设置通知服务的启用状态
   * @param enabled - 是否启用通知服务
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * 设置静音模式
   * @param silent - 是否启用静音模式
   */
  setSilentMode(silent: boolean): void {
    this.silentMode = silent
  }

  /**
   * 显示系统通知
   * @param options - 通知配置选项
   * @returns 通知发送结果，包含是否成功和通知ID
   */
  async showNotification(options: NotificationOptions): Promise<NotificationResult> {
    if (!this.enabled) {
      return {
        success: false
      }
    }

    const notificationId = createId()
    const silent = options.silent ?? this.silentMode

    try {
      const notification = new Notification({
        title: `${notificationIcons[options.type] ?? '📌'} ${options.title}`,
        body: options.body,
        silent,
        urgency: options.urgency ?? 'normal'
      })

      notification.show()

      return {
        success: true,
        notificationId
      }
    } catch (error) {
      return {
        success: false
      }
    }
  }

  /**
   * 发送任务即将到期的通知
   * @param taskTitle - 任务标题
   * @param dueDate - 到期日期
   */
  async notifyTaskDue(taskTitle: string, dueDate: string): Promise<NotificationResult> {
    return this.showNotification({
      type: 'task_due',
      title: '任务即将到期',
      body: `任务 "${taskTitle}" 将于 ${dueDate} 到期`,
      urgency: 'normal'
    })
  }

  /**
   * 发送任务完成的通知
   * @param taskTitle - 任务标题
   */
  async notifyTaskCompleted(taskTitle: string): Promise<NotificationResult> {
    return this.showNotification({
      type: 'task_completed',
      title: '任务已完成',
      body: `任务 "${taskTitle}" 已标记为完成`,
      urgency: 'low'
    })
  }

  /**
   * 发送计时完成的通知
   * @param taskTitle - 任务标题
   * @param durationMinutes - 计时时长（分钟）
   */
  async notifyTimerComplete(taskTitle: string, durationMinutes: number): Promise<NotificationResult> {
    return this.showNotification({
      type: 'timer_complete',
      title: '计时已完成',
      body: `专注 "${taskTitle}" ${durationMinutes} 分钟，继续加油！`,
      urgency: 'normal'
    })
  }

  /**
   * 发送操作成功的通知
   * @param message - 成功消息
   */
  async notifySuccess(message: string): Promise<NotificationResult> {
    return this.showNotification({
      type: 'success',
      title: '操作成功',
      body: message,
      urgency: 'low'
    })
  }

  /**
   * 发送操作失败的通知
   * @param message - 错误消息
   */
  async notifyError(message: string): Promise<NotificationResult> {
    return this.showNotification({
      type: 'error',
      title: '操作失败',
      body: message,
      urgency: 'critical'
    })
  }
}
