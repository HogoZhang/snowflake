import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { ShortcutAction, ShortcutDefinition } from '@shared/schema'
import { getDesktopApi } from '@renderer/desktopApi'

type ShortcutHandler = (action: ShortcutAction) => void

const shortcutActionLabels: Record<ShortcutAction, string> = {
  new_task: '新建任务',
  toggle_timer: '切换计时',
  complete_task: '完成任务',
  open_tasks: '打开任务页面',
  open_journal: '打开日记页面',
  open_analytics: '打开统计页面',
  open_settings: '打开设置页面',
  search: '搜索'
}

export function useShortcuts(): {
  shortcuts: ShortcutDefinition[]
  actionLabels: Record<ShortcutAction, string>
  setActionHandler: (handler: ShortcutHandler) => void
  navigateAction: (action: ShortcutAction) => string | null
} {
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>([])
  const [actionHandler, setActionHandler] = useState<ShortcutHandler | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const loadShortcuts = async (): Promise<void> => {
      try {
        const api = getDesktopApi()
        const loaded = await api.getShortcuts()
        setShortcuts(loaded)
      } catch (error) {
        console.error('Failed to load shortcuts:', error)
      }
    }

    void loadShortcuts()
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const message = event.data as { type: string; action?: ShortcutAction; route?: string } | undefined

      if (!message) {
        return
      }

      if (message.type === 'shortcut:action' && message.action && actionHandler) {
        actionHandler(message.action)
      }

      if (message.type === 'shortcut:navigate' && message.route) {
        navigate(message.route)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [actionHandler, navigate])

  const navigateAction = (action: ShortcutAction): string | null => {
    const routeMap: Record<ShortcutAction, string | null> = {
      new_task: null,
      toggle_timer: null,
      complete_task: null,
      open_tasks: '/',
      open_journal: '/journal',
      open_analytics: '/analytics',
      open_settings: '/settings',
      search: null
    }
    return routeMap[action] ?? null
  }

  return {
    shortcuts,
    actionLabels: shortcutActionLabels,
    setActionHandler,
    navigateAction
  }
}
