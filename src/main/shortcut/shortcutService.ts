import type { ShortcutAction, ShortcutDefinition } from '@shared/schema'

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/**
 * 默认快捷键定义
 * 包含常用操作的快捷键预设，使用Electron加速器格式
 * CmdOrCtrl会自动适配macOS和Windows/Linux
 */
export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    action: 'new_task',
    accelerator: 'CmdOrCtrl+N',
    enabled: true
  },
  {
    action: 'toggle_timer',
    accelerator: 'CmdOrCtrl+T',
    enabled: true
  },
  {
    action: 'complete_task',
    accelerator: 'CmdOrCtrl+Enter',
    enabled: true
  },
  {
    action: 'open_tasks',
    accelerator: 'CmdOrCtrl+1',
    enabled: true
  },
  {
    action: 'open_journal',
    accelerator: 'CmdOrCtrl+2',
    enabled: true
  },
  {
    action: 'open_analytics',
    accelerator: 'CmdOrCtrl+3',
    enabled: true
  },
  {
    action: 'open_settings',
    accelerator: 'CmdOrCtrl+,',
    enabled: true
  },
  {
    action: 'search',
    accelerator: 'CmdOrCtrl+F',
    enabled: true
  }
]

/**
 * 快捷键回调接口
 * 当快捷键被触发时调用
 */
export interface ShortcutCallback {
  onAction: (action: ShortcutAction) => void
}

/**
 * 全局快捷键注册器接口
 * 抽象Electron的globalShortcut API，便于测试和替换
 */
export interface GlobalShortcutRegistry {
  register: (accelerator: string, callback: () => void) => boolean
  unregister: (accelerator: string) => void
  unregisterAll: () => void
}

/**
 * 快捷键服务类
 * 管理全局快捷键的注册、启用/禁用和触发
 * 支持在应用处于后台时也能响应快捷键
 */
export class ShortcutService {
  /** 快捷键配置映射表 */
  private shortcuts: Map<ShortcutAction, ShortcutDefinition>
  /** 快捷键触发回调 */
  private callback: ShortcutCallback | null = null
  /** 全局快捷键注册器 */
  private registry: GlobalShortcutRegistry | null = null

  constructor() {
    this.shortcuts = new Map(
      DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.action, { ...shortcut }])
    )
  }

  /**
   * 设置快捷键触发回调
   * @param callback - 回调函数
   */
  setCallback(callback: ShortcutCallback): void {
    this.callback = callback
  }

  /**
   * 设置全局快捷键注册器
   * 通常在应用ready时设置，使用Electron的globalShortcut
   * @param registry - 注册器实例
   */
  setRegistry(registry: GlobalShortcutRegistry): void {
    this.registry = registry
  }

  /**
   * 获取所有快捷键定义
   * @returns 快捷键定义数组
   */
  getShortcuts(): ShortcutDefinition[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * 获取指定动作的快捷键定义
   * @param action - 快捷键动作
   * @returns 快捷键定义（如果存在）
   */
  getShortcut(action: ShortcutAction): ShortcutDefinition | undefined {
    return this.shortcuts.get(action)
  }

  /**
   * 更新单个快捷键的启用状态
   * 更新后会自动刷新注册器
   * @param action - 快捷键动作
   * @param enabled - 是否启用
   * @returns 更新后的快捷键列表
   */
  updateShortcut(action: ShortcutAction, enabled: boolean): ShortcutDefinition[] {
    const shortcut = this.shortcuts.get(action)
    if (shortcut) {
      shortcut.enabled = enabled
      this.refreshRegistry()
    }
    return this.getShortcuts()
  }

  /**
   * 批量更新所有快捷键
   * @param shortcuts - 新的快捷键定义数组
   * @returns 更新后的快捷键列表
   */
  updateAllShortcuts(shortcuts: ShortcutDefinition[]): ShortcutDefinition[] {
    for (const shortcut of shortcuts) {
      const existing = this.shortcuts.get(shortcut.action)
      if (existing) {
        existing.accelerator = shortcut.accelerator
        existing.enabled = shortcut.enabled
      }
    }
    this.refreshRegistry()
    return this.getShortcuts()
  }

  /**
   * 刷新快捷键注册器
   * 先注销所有已注册的快捷键，然后重新注册所有启用的快捷键
   * 通常在配置更改后调用
   */
  refreshRegistry(): void {
    if (!this.registry) {
      return
    }

    this.registry.unregisterAll()

    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) {
        continue
      }

      try {
        const registered = this.registry.register(shortcut.accelerator, () => {
          if (this.callback) {
            this.callback.onAction(shortcut.action)
          }
        })

        if (!registered) {
          console.warn(`Shortcut not available: ${shortcut.accelerator} for action: ${shortcut.action}`)
        }
      } catch (error) {
        console.error(`Failed to register shortcut: ${shortcut.accelerator}`, error)
      }
    }
  }

  /**
   * 手动执行快捷键动作
   * 可用于测试或程序化触发
   * @param action - 快捷键动作
   */
  executeAction(action: ShortcutAction): void {
    if (this.callback) {
      this.callback.onAction(action)
    }
  }

  /**
   * 获取动作对应的路由路径
   * 用于导航类快捷键自动跳转到对应页面
   * @param action - 快捷键动作
   * @returns 路由路径（如果是导航类动作），否则返回null
   */
  getActionRoute(action: ShortcutAction): string | null {
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
}
