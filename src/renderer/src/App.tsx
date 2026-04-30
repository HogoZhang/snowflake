import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'

import type {
  AppSettings,
  ImportMode,
  ShortcutAction,
  ShortcutDefinition,
  StorageSnapshot,
  ThemeId
} from '@shared/schema'
import { Button, Card, Input, Select } from '@renderer/components/ui'
import { getDesktopApi } from './desktopApi'
import { useNotification } from './hooks/useNotification'
import { useShortcuts } from './hooks/useShortcuts'
import { AnalyticsPage as Phase5AnalyticsPage } from './pages/AnalyticsPage'
import { JournalPage } from './pages/JournalPage'
import { TasksPage } from './pages/TasksPage'
import { applyThemeToDocument, getThemeDefinition, getThemeDefinitions } from './themes/catalog'

const navItems = [
  { to: '/', label: '任务管理', shortcut: 'CmdOrCtrl+1' },
  { to: '/journal', label: '日记归总', shortcut: 'CmdOrCtrl+2' },
  { to: '/analytics', label: '统计图表', shortcut: 'CmdOrCtrl+3' },
  { to: '/settings', label: '应用设置', shortcut: 'CmdOrCtrl+,' }
] as const

const metricCards = [
  { title: 'Schema Version', key: 'schemaVersion' },
  { title: 'Documents', key: 'documents' },
  { title: 'Storage Path', key: 'storagePath' }
] as const

const analyticsPieData = [
  { name: '工作', value: 400, color: 'var(--chart-1)' },
  { name: '阅读', value: 300, color: 'var(--chart-2)' },
  { name: '生活', value: 300, color: 'var(--chart-3)' },
  { name: '健身', value: 290, color: 'var(--chart-4)' }
] as const

const analyticsLineData = [
  { name: '周一', minutes: 120 },
  { name: '周二', minutes: 210 },
  { name: '周三', minutes: 180 },
  { name: '周四', minutes: 240 },
  { name: '周五', minutes: 150 },
  { name: '周六', minutes: 300 },
  { name: '周日', minutes: 90 }
] as const

const themeOptions = getThemeDefinitions()

export function App(): ReactElement {
  const navigate = useNavigate()
  const { notifySuccess, notifyError } = useNotification()
  const { shortcuts, setActionHandler } = useShortcuts()

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [snapshot, setSnapshot] = useState<StorageSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null)
  const [readyThemeIds, setReadyThemeIds] = useState<ThemeId[]>([])

  const handleShortcutAction = (action: ShortcutAction): void => {
    void getDesktopApi().logInfo('Shortcut', `Shortcut action triggered: ${action}`)

    switch (action) {
      case 'open_tasks':
        navigate('/')
        break
      case 'open_journal':
        navigate('/journal')
        break
      case 'open_analytics':
        navigate('/analytics')
        break
      case 'open_settings':
        navigate('/settings')
        break
      case 'search':
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
        break
      case 'new_task':
      case 'toggle_timer':
      case 'complete_task':
        void notifySuccess(`快捷键触发: ${action}`)
        break
    }
  }

  useEffect(() => {
    setActionHandler(handleShortcutAction)
  }, [setActionHandler])

  const loadAppState = async (): Promise<void> => {
    const api = getDesktopApi()
    try {
      setLoading(true)
      const [nextSettings, nextSnapshot] = await Promise.all([
        api.getSettings(),
        api.getStorageSnapshot()
      ])
      setSettings(nextSettings)
      setSnapshot(nextSnapshot)
      setError(null)
      void api.logInfo('App', 'Application state loaded successfully')
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load app state.'
      setError(message)
      void api.logError('App', 'Failed to load app state', { error: message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAppState()
  }, [])

  const currentThemeId = previewThemeId ?? settings?.activeThemeId ?? 'default'
  const currentTheme = getThemeDefinition(currentThemeId)

  useEffect(() => {
    let isActive = true

    void applyThemeToDocument(currentThemeId).then(() => {
      if (!isActive) {
        return
      }

      setReadyThemeIds((current) => (current.includes(currentThemeId) ? current : [...current, currentThemeId]))
    })

    return () => {
      isActive = false
    }
  }, [currentThemeId])

  const appSummary = useMemo(
    () => ({
      schemaVersion: snapshot?.schemaVersion ?? '-',
      documents: snapshot?.availableDocuments.length ?? 0,
      storagePath: settings?.storagePath ?? '-'
    }),
    [settings, snapshot]
  )

  const handleSettingsChange = async (patch: Partial<AppSettings>): Promise<void> => {
    const api = getDesktopApi()
    try {
      const nextSettings = await api.updateSettings(patch)
      setSettings(nextSettings)
      setPreviewThemeId(null)
      const nextSnapshot = await api.getStorageSnapshot()
      setSnapshot(nextSnapshot)
      void notifySuccess('设置已保存')
      void api.logInfo('Settings', 'Settings updated successfully')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save settings.'
      void notifyError(message)
      void api.logError('Settings', 'Failed to update settings', { error: message })
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <div className="brand-identity">
            <span className="brand-mark" aria-hidden="true" />
            <h1 className="brand-name">Snowflake</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              title={`${item.label} (${item.shortcut})`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content-area">
        <header className="topbar">
          <p className="topbar-theme-copy">当前主题：{currentTheme.displayName}</p>
          <div className="status-pill">
            <span className="status-dot" />
            {loading ? '正在加载本地数据' : '本地工作台已就绪'}
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <Routes>
          <Route path="/" element={<TasksPage onNotifySuccess={notifySuccess} onNotifyError={notifyError} />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route
            path="/analytics"
            element={<Phase5AnalyticsPage settings={settings} />}
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                settings={settings}
                snapshot={snapshot}
                shortcuts={shortcuts}
                onReload={loadAppState}
                onSave={handleSettingsChange}
                onPreviewTheme={setPreviewThemeId}
                readyThemeIds={readyThemeIds}
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

function OverviewPage({
  metrics
}: {
  metrics: Record<(typeof metricCards)[number]['key'], string | number>
}): ReactElement {
  return (
    <section className="page-grid">
      <div className="hero-card">
        <p className="eyebrow">Phase 0</p>
        <h3>Electron application shell is in place</h3>
        <p className="muted">
          The app ships with React, TypeScript, routed pages, a preload bridge and a dedicated main
          process for desktop-only capabilities.
        </p>
      </div>

      <div className="metric-grid">
        {metricCards.map((card) => (
          <article key={card.key} className="metric-card">
            <p className="metric-label">{card.title}</p>
            <strong>{metrics[card.key]}</strong>
          </article>
        ))}
      </div>

      <section className="list-card">
        <div>
          <p className="eyebrow">Phase 1</p>
          <h3>Storage and settings baseline</h3>
        </div>
        <ul className="feature-list">
          <li>JSON documents for tasks, journals and settings are initialized automatically.</li>
          <li>Writes are debounced and serialized through a shared storage queue.</li>
          <li>Atomic writes create `.bak` backups for recovery.</li>
          <li>The active theme is stored locally and applied live to the UI.</li>
        </ul>
      </section>
    </section>
  )
}

function AnalyticsPage({
  settings
}: {
  settings: AppSettings | null
}): ReactElement {
  return (
    <section className="analytics-page">
      <header className="analytics-header">
        <div className="analytics-orb analytics-orb-left" />
        <div className="analytics-orb analytics-orb-right" />
        <div className="analytics-header-content">
          <h3 className="analytics-title">
            统计图表
            <span className="analytics-title-emoji" aria-hidden="true">
              📊
            </span>
          </h3>
          <p className="analytics-subtitle">
            回顾本周专注时长与效率，为您提供最直观的分析。
          </p>
        </div>
      </header>

      <div className="analytics-summary-grid">
        <AnalyticsMetricCard
          title="完成任务数"
          value="24"
          suffix="个"
          tone="primary"
          icon={<CheckIcon />}
        />
        <AnalyticsMetricCard
          title="总专注时长"
          value="1290"
          suffix="分钟"
          tone="secondary"
          icon={<ClockIcon />}
        />
        <AnalyticsMetricCard
          title="最高效分类"
          value="工作"
          suffix="400m"
          tone="blend"
          icon={<FlameIcon />}
        />
      </div>

      <div className="analytics-chart-grid">
        <article className="analytics-panel">
          <div className="analytics-panel-header">
            <h4 className="analytics-panel-title">
              <span className="analytics-panel-icon tone-primary">
                <BarChartIcon />
              </span>
              时间分配
            </h4>
            <span className="analytics-panel-emoji" aria-hidden="true">
              🥧
            </span>
          </div>
          <DonutChart data={analyticsPieData} total={1290} centerLabel="总分钟数" />
          <div className="analytics-legend">
            {analyticsPieData.map((item) => (
              <div key={item.name} className="analytics-legend-item">
                <span className="analytics-legend-dot" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-header">
            <h4 className="analytics-panel-title">
              <span className="analytics-panel-icon tone-secondary">
                <BarChartIcon />
              </span>
              任务趋势
            </h4>
            <span className="analytics-panel-emoji" aria-hidden="true">
              📈
            </span>
          </div>
          <TrendLineChart data={analyticsLineData} />
        </article>
      </div>

      <footer className="analytics-footer-note">
        <span className="analytics-theme-pill">当前主题：{settings?.activeThemeId ?? 'default'}</span>
        <span>该页面已按 Figma Make 的 analytics 结构与配色重新对齐。</span>
      </footer>
    </section>
  )
}

function AnalyticsMetricCard({
  title,
  value,
  suffix,
  tone,
  icon
}: {
  title: string
  value: string
  suffix: string
  tone: 'primary' | 'secondary' | 'blend'
  icon: ReactElement
}): ReactElement {
  return (
    <article className={`analytics-stat-card tone-${tone}`}>
      <div className={`analytics-stat-icon tone-${tone}`}>{icon}</div>
      <div>
        <p className="analytics-stat-label">{title}</p>
        <div className="analytics-stat-value">
          {value}
          <span>{suffix}</span>
        </div>
      </div>
    </article>
  )
}

function DonutChart({
  data,
  total,
  centerLabel
}: {
  data: ReadonlyArray<{ name: string; value: number; color: string }>
  total: number
  centerLabel: string
}): ReactElement {
  const radius = 66
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <div className="analytics-donut-wrap">
      <svg className="analytics-donut" viewBox="0 0 220 220" role="img" aria-label="时间分配图">
        <circle className="analytics-donut-track" cx="110" cy="110" r={radius} />
        <g transform="rotate(-90 110 110)">
          {data.map((item) => {
            const fraction = item.value / total
            const dash = circumference * fraction
            const offset = -cumulative * circumference
            cumulative += fraction

            return (
              <circle
                key={item.name}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="26"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
              />
            )
          })}
        </g>
        <text x="110" y="108" textAnchor="middle" className="analytics-donut-total">
          {total}
        </text>
        <text x="110" y="132" textAnchor="middle" className="analytics-donut-label">
          {centerLabel}
        </text>
      </svg>
    </div>
  )
}

function TrendLineChart({
  data
}: {
  data: ReadonlyArray<{ name: string; minutes: number }>
}): ReactElement {
  const width = 420
  const height = 280
  const padding = { top: 18, right: 18, bottom: 38, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(...data.map((item) => item.minutes))
  const ySteps = 4

  const points = data.map((item, index) => {
    const x = padding.left + (chartWidth / Math.max(data.length - 1, 1)) * index
    const y = padding.top + chartHeight - (item.minutes / maxValue) * chartHeight
    return { ...item, x, y }
  })

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  return (
    <div className="analytics-line-wrap">
      <svg className="analytics-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="任务趋势图">
        {Array.from({ length: ySteps + 1 }, (_, index) => {
          const y = padding.top + (chartHeight / ySteps) * index
          const value = Math.round(maxValue - (maxValue / ySteps) * index)
          return (
            <g key={`${index}-${value}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                className="analytics-grid-line"
              />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="analytics-axis-label">
                {value}
              </text>
            </g>
          )
        })}

        {points.map((point) => (
          <text
            key={point.name}
            x={point.x}
            y={height - 12}
            textAnchor="middle"
            className="analytics-axis-label"
          >
            {point.name}
          </text>
        ))}

        <path d={path} className="analytics-line-path" />
        {points.map((point) => (
          <g key={`${point.name}-${point.minutes}`}>
            <circle cx={point.x} cy={point.y} r="6" className="analytics-line-dot-ring" />
            <circle cx={point.x} cy={point.y} r="3.5" className="analytics-line-dot-core" />
          </g>
        ))}
      </svg>
    </div>
  )
}

function CheckIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 7L10 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClockIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M12 7.5v5l3.4 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FlameIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.8 3.5c.5 2.6-.8 4.4-2.1 5.7-1.3 1.2-2.4 2.2-2.4 4 0 2 1.3 3.5 3.1 3.5 2.1 0 3.7-1.7 3.7-4.1 0-1.4-.6-2.6-1.8-4.2 2 .7 4.7 3 4.7 6.8 0 3.9-2.9 6.8-6.8 6.8-4.1 0-7.1-3-7.1-7 0-4.7 3.2-7.3 5.3-9.2 1.2-1.1 2.4-2.1 3.4-4.3z"
        fill="currentColor"
      />
    </svg>
  )
}

function BarChartIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 18V11M12 18V7M18 18V13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M4 18.5h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

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

function SettingsPage({
  settings,
  snapshot,
  shortcuts,
  onReload,
  onSave,
  onPreviewTheme,
  readyThemeIds
}: {
  settings: AppSettings | null
  snapshot: StorageSnapshot | null
  shortcuts: ShortcutDefinition[]
  onReload: () => Promise<void>
  onSave: (patch: Partial<AppSettings>) => Promise<void>
  onPreviewTheme: (themeId: ThemeId | null) => void
  readyThemeIds: ThemeId[]
}): ReactElement {
  const [draft, setDraft] = useState<AppSettings | null>(settings)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [includeImportedSettings, setIncludeImportedSettings] = useState(false)
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  if (!draft) {
    return <Card className="list-card">Loading settings...</Card>
  }

  const selectedTheme = getThemeDefinition(draft.activeThemeId)
  const hasUnsavedTheme = settings ? settings.activeThemeId !== draft.activeThemeId : false

  const handleThemeSelection = (themeId: ThemeId): void => {
    setDraft((current) => (current ? { ...current, activeThemeId: themeId } : current))
    onPreviewTheme(themeId)
    setFeedback('Theme preview applied. Save settings to persist it.')
  }

  const handleToggleShortcut = async (action: ShortcutAction, enabled: boolean): Promise<void> => {
    try {
      const desktopApi = getDesktopApi()
      await desktopApi.updateShortcut(action, enabled)
      setFeedback(`快捷键 ${shortcutActionLabels[action]} 已${enabled ? '启用' : '禁用'}`)
      void desktopApi.logInfo('Settings', 'Shortcut updated', { action, enabled })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update shortcut.'
      setFeedback(message)
      void getDesktopApi().logError('Settings', 'Failed to update shortcut', { error: message })
    }
  }

  const runTransfer = async (action: () => Promise<string>, shouldReload = false): Promise<void> => {
    setIsTransferring(true)
    setTransferFeedback(null)

    try {
      const message = await action()
      setTransferFeedback(message)
      if (shouldReload) {
        await onReload()
      }
    } catch (transferError) {
      setTransferFeedback(
        transferError instanceof Error ? transferError.message : 'Failed to complete data transfer.'
      )
    } finally {
      setIsTransferring(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setIsSaving(true)
    setFeedback(null)

    try {
      await onSave({
        activeThemeId: draft.activeThemeId,
        autoSaveIntervalMs: draft.autoSaveIntervalMs,
        locale: draft.locale,
        storagePath: draft.storagePath,
        useSystemTitleBar: draft.useSystemTitleBar
      })
      setFeedback('Settings saved locally.')
    } catch (saveError) {
      setFeedback(saveError instanceof Error ? saveError.message : 'Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="settings-layout">
      <form className="ui-card list-card settings-form" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">Theme System</p>
          <h3>Appearance, persistence and live preview</h3>
          <p className="muted">
            Themes switch through the root `data-theme` flow and are persisted by the main-process storage
            service instead of browser localStorage.
          </p>
        </div>

        <div className="field">
          <span>Theme</span>
          <div className="theme-preview-grid">
            {themeOptions.map((theme) => {
              const isSelected = draft.activeThemeId === theme.id
              const isReady = readyThemeIds.includes(theme.id)

              return (
                <button
                  key={theme.id}
                  type="button"
                  className={isSelected ? 'theme-preview-card active' : 'theme-preview-card'}
                  aria-pressed={isSelected}
                  onClick={() => handleThemeSelection(theme.id)}
                >
                  <div className="theme-preview-art" style={{ background: theme.preview.gradient }}>
                    <span className="theme-preview-sticker">{theme.preview.sticker}</span>
                    <div className="theme-preview-swatches">
                      <span style={{ background: theme.preview.accent }} />
                      <span style={{ background: theme.preview.secondary }} />
                      <span style={{ background: theme.preview.surface, borderColor: theme.preview.outline }} />
                    </div>
                  </div>
                  <div className="theme-preview-body">
                    <div className="theme-preview-header">
                      <strong>{theme.displayName}</strong>
                      <span className={isReady ? 'theme-preview-status ready' : 'theme-preview-status'}>
                        {isReady ? '资源已缓存' : '首次切换懒加载'}
                      </span>
                    </div>
                    <p>{theme.description}</p>
                    <span className="theme-preview-meta">
                      {theme.fontLabel} · {theme.iconSet}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          {hasUnsavedTheme ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleThemeSelection(settings?.activeThemeId ?? 'default')}
            >
              恢复已保存主题
            </Button>
          ) : null}
        </div>

        <div className="theme-selected-panel">
          <div>
            <p className="eyebrow">Selected Theme</p>
            <h4>{selectedTheme.displayName}</h4>
            <p className="muted">{selectedTheme.description}</p>
          </div>
          <div className="theme-selected-meta">
            <span>主题 ID：{selectedTheme.id}</span>
            <span>字体：{selectedTheme.fontLabel}</span>
            <span>图标：{selectedTheme.iconSet}</span>
            <span>{readyThemeIds.includes(selectedTheme.id) ? '资源状态：已就绪' : '资源状态：等待首次加载'}</span>
          </div>
        </div>

        <label className="field">
          <span>Language</span>
          <Select
            value={draft.locale}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, locale: event.target.value as AppSettings['locale'] } : current
              )
            }
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </Select>
        </label>

        <label className="field">
          <span>Auto Save Interval (ms)</span>
          <Input
            type="number"
            min={100}
            step={100}
            value={draft.autoSaveIntervalMs}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? { ...current, autoSaveIntervalMs: Number.parseInt(event.target.value, 10) || 500 }
                  : current
              )
            }
          />
        </label>

        <label className="field">
          <span>Storage Path</span>
          <Input
            type="text"
            value={draft.storagePath}
            onChange={(event) =>
              setDraft((current) => (current ? { ...current, storagePath: event.target.value } : current))
            }
          />
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={draft.useSystemTitleBar}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, useSystemTitleBar: event.target.checked } : current
              )
            }
          />
          <span>Prefer system title bar on future windows</span>
        </label>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save settings'}
        </Button>

        {feedback ? <p className="feedback">{feedback}</p> : null}
      </form>

      <Card className="list-card">
        <p className="eyebrow">Storage Snapshot</p>
        <h3>Local persistence status</h3>
        <ul className="feature-list compact">
          <li>Directory: {snapshot?.dataDirectory ?? '-'}</li>
          <li>Documents: {snapshot?.availableDocuments.join(', ') ?? '-'}</li>
          <li>Schema: {snapshot?.schemaVersion ?? '-'}</li>
          <li>Updated At: {draft.updatedAt}</li>
        </ul>
      </Card>

      <Card className="list-card settings-actions-card">
        <p className="eyebrow">Keyboard Shortcuts</p>
        <h3>全局快捷键设置</h3>
        <p className="muted">
          启用或禁用全局快捷键，这些快捷键在应用处于后台时也可使用。
        </p>
        <div className="shortcut-list">
          {shortcuts.map((shortcut) => (
            <label key={shortcut.action} className="checkbox-field">
              <input
                type="checkbox"
                checked={shortcut.enabled}
                onChange={(event) => void handleToggleShortcut(shortcut.action, event.target.checked)}
              />
              <span>
                {shortcutActionLabels[shortcut.action]}
                <code className="shortcut-key">{shortcut.accelerator}</code>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="list-card settings-actions-card">
        <p className="eyebrow">Import / Export</p>
        <h3>Data portability and backups</h3>
        <p className="muted">
          Export a `.snowflake` package for migration, save a raw JSON snapshot, or import another package
          with overwrite / merge mode.
        </p>

        <div className="settings-action-grid">
          <Button
            type="button"
            disabled={isTransferring}
            onClick={() =>
              void runTransfer(async () => {
                const result = await getDesktopApi().exportSnowflakePackage()
                return `Package exported to ${result.filePath}`
              })
            }
          >
            导出 .snowflake
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isTransferring}
            onClick={() =>
              void runTransfer(async () => {
                const result = await getDesktopApi().exportJsonSnapshot()
                return `JSON snapshot exported to ${result.filePath}`
              })
            }
          >
            导出 JSON
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={isTransferring}
            onClick={() =>
              void runTransfer(async () => {
                const result = await getDesktopApi().createBackupSnapshot()
                return `Backup created at ${result.filePath}`
              })
            }
          >
            创建备份
          </Button>
        </div>

        <div className="settings-transfer-row">
          <label className="field">
            <span>Import Mode</span>
            <Select value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}>
              <option value="merge">Merge import</option>
              <option value="overwrite">Overwrite import</option>
            </Select>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={includeImportedSettings}
              onChange={(event) => setIncludeImportedSettings(event.target.checked)}
            />
            <span>同时导入设置（保留当前 storage path）</span>
          </label>
        </div>

        <Button
          type="button"
          variant="danger"
          disabled={isTransferring}
          onClick={() =>
            void runTransfer(async () => {
              const result = await getDesktopApi().importSnowflakePackage(
                importMode,
                includeImportedSettings
              )
              return `Imported ${result.importedDocuments.join(', ')} from ${result.filePath}. Backup: ${result.backupPath}`
            }, true)
          }
        >
          {isTransferring ? '处理中...' : '导入 .snowflake'}
        </Button>

        {transferFeedback ? <p className="feedback">{transferFeedback}</p> : null}
      </Card>
    </section>
  )
}
