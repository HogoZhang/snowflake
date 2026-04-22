import { useEffect, useMemo, useState, type ReactElement } from 'react'

import type {
  AnalyticsHeatmapType,
  AnalyticsQueryInput,
  AnalyticsSnapshot,
  AppSettings,
  CategoryStat,
  HeatmapPoint
} from '@shared/schema'
import { Badge, Button, Card, Input, Select } from '@renderer/components/ui'
import { getDesktopApi } from '@renderer/desktopApi'

type RangePreset = 'week' | 'month' | 'custom'

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

const formatDateKey = (value: Date): string => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildWeekRange = (): AnalyticsQueryInput => {
  const now = new Date()
  const currentDay = now.getDay() || 7
  const start = new Date(now)
  start.setDate(now.getDate() - currentDay + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end)
  }
}

const buildMonthRange = (): AnalyticsQueryInput => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end)
  }
}

const defaultRange = buildWeekRange()

export function AnalyticsPage({
  settings
}: {
  settings: AppSettings | null
}): ReactElement {
  const [preset, setPreset] = useState<RangePreset>('week')
  const [range, setRange] = useState<AnalyticsQueryInput>(defaultRange)
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [heatmapType, setHeatmapType] = useState<AnalyticsHeatmapType>('task')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAnalytics = async (): Promise<void> => {
      try {
        setLoading(true)
        const nextSnapshot = await getDesktopApi().getAnalyticsSnapshot(range)
        setSnapshot(nextSnapshot)
        setSelectedDate((current) =>
          current && nextSnapshot.dailySummaries.some((item) => item.date === current)
            ? current
            : nextSnapshot.dailySummaries.find((item) => item.completedTasks > 0 || item.totalMinutes > 0)?.date ?? null
        )
        setSelectedCategoryId((current) =>
          current && nextSnapshot.categoryStats.some((item) => item.categoryId === current)
            ? current
            : nextSnapshot.topCategory?.categoryId ?? null
        )
        setError(null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics.')
      } finally {
        setLoading(false)
      }
    }

    void loadAnalytics()
  }, [range])

  const donutData = useMemo(
    () =>
      (snapshot?.categoryStats ?? []).map((item, index) => ({
        name: item.categoryName,
        value: item.totalMinutes,
        categoryId: item.categoryId,
        color: chartColors[index % chartColors.length]
      })),
    [snapshot]
  )

  const trendData = useMemo(
    () =>
      (snapshot?.dailySummaries ?? []).map((item) => ({
        date: item.date,
        label: item.date.slice(5),
        completedTasks: item.completedTasks
      })),
    [snapshot]
  )

  const heatmapData = useMemo(
    () => (snapshot?.heatmapPoints ?? []).filter((point) => point.type === heatmapType),
    [heatmapType, snapshot]
  )

  const selectedCategory = snapshot?.categoryStats.find((item) => item.categoryId === selectedCategoryId) ?? null
  const selectedDateSummary = snapshot?.dailySummaries.find((item) => item.date === selectedDate) ?? null

  const detailTasks = useMemo(() => {
    if (!snapshot) {
      return []
    }

    return snapshot.taskDetails.filter((task) => {
      const matchesCategory = !selectedCategoryId || task.categoryId === selectedCategoryId
      const taskDate = task.completedAt ? formatDateKey(new Date(task.completedAt)) : null
      const matchesDate = !selectedDate || taskDate === selectedDate
      return matchesCategory && matchesDate
    })
  }, [selectedCategoryId, selectedDate, snapshot])

  const detailJournals = useMemo(() => {
    if (!snapshot || !selectedDate) {
      return []
    }

    return snapshot.journalDetails.filter((entry) => entry.date === selectedDate)
  }, [selectedDate, snapshot])

  const handlePresetChange = (value: RangePreset): void => {
    setPreset(value)
    if (value === 'week') {
      setRange(buildWeekRange())
    } else if (value === 'month') {
      setRange(buildMonthRange())
    }
  }

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
          <p className="analytics-subtitle">从任务和日记数据里回看你的时间分配、完成趋势和记录习惯。</p>
        </div>
      </header>

      <Card className="analytics-toolbar">
        <div className="analytics-toolbar-row">
          <label className="field">
            <span>时间范围</span>
            <Select value={preset} onChange={(event) => handlePresetChange(event.target.value as RangePreset)}>
              <option value="week">本周</option>
              <option value="month">本月</option>
              <option value="custom">自定义</option>
            </Select>
          </label>

          <label className="field">
            <span>开始日期</span>
            <Input
              type="date"
              value={range.startDate}
              onChange={(event) => {
                setPreset('custom')
                setRange((current) => ({ ...current, startDate: event.target.value }))
              }}
            />
          </label>

          <label className="field">
            <span>结束日期</span>
            <Input
              type="date"
              value={range.endDate}
              onChange={(event) => {
                setPreset('custom')
                setRange((current) => ({ ...current, endDate: event.target.value }))
              }}
            />
          </label>
        </div>
      </Card>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? <Card className="list-card">Loading analytics...</Card> : null}

      {!loading && snapshot ? (
        <>
          <div className="analytics-summary-grid">
            <AnalyticsMetricCard
              title="完成任务数"
              value={snapshot.completedTaskCount.toString()}
              suffix="个"
              tone="primary"
              icon={<CheckIcon />}
            />
            <AnalyticsMetricCard
              title="总专注时长"
              value={snapshot.totalFocusMinutes.toString()}
              suffix="分钟"
              tone="secondary"
              icon={<ClockIcon />}
            />
            <AnalyticsMetricCard
              title="最高效分类"
              value={snapshot.topCategory?.categoryName ?? '暂无'}
              suffix={snapshot.topCategory ? `${snapshot.topCategory.totalMinutes}m` : ''}
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
              <DonutChart
                data={donutData}
                total={snapshot.totalFocusMinutes}
                centerLabel="总分钟数"
                onSelectCategory={setSelectedCategoryId}
              />
              <div className="analytics-legend">
                {donutData.map((item) => (
                  <button
                    key={item.categoryId}
                    type="button"
                    className={
                      selectedCategoryId === item.categoryId
                        ? 'analytics-legend-item analytics-legend-item-active'
                        : 'analytics-legend-item'
                    }
                    onClick={() => setSelectedCategoryId(item.categoryId)}
                  >
                    <span className="analytics-legend-dot" style={{ backgroundColor: item.color }} />
                    <span>
                      {item.name} · {item.value}m
                    </span>
                  </button>
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
              <TrendLineChart data={trendData} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-header">
                <h4 className="analytics-panel-title">
                  <span className="analytics-panel-icon tone-primary">
                    <HeatmapIcon />
                  </span>
                  活跃/写作热力图
                </h4>
                <div className="analytics-toggle-group">
                  <Button
                    type="button"
                    size="sm"
                    variant={heatmapType === 'task' ? 'secondary' : 'ghost'}
                    onClick={() => setHeatmapType('task')}
                  >
                    任务
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={heatmapType === 'journal' ? 'secondary' : 'ghost'}
                    onClick={() => setHeatmapType('journal')}
                  >
                    日记
                  </Button>
                </div>
              </div>
              <HeatmapGrid data={heatmapData} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-header">
                <h4 className="analytics-panel-title">
                  <span className="analytics-panel-icon tone-secondary">
                    <ScaleIcon />
                  </span>
                  效率对比
                </h4>
                <Badge tone="secondary">{snapshot.efficiencyRecords.length} 项</Badge>
              </div>
              <EfficiencyList records={snapshot.efficiencyRecords} />
            </article>
          </div>

          <div className="analytics-chart-grid analytics-chart-grid-single">
            <article className="analytics-panel analytics-detail-panel">
              <div className="analytics-panel-header">
                <h4 className="analytics-panel-title">
                  <span className="analytics-panel-icon tone-blend">
                    <BarChartIcon />
                  </span>
                  下钻明细
                </h4>
                <Badge tone="neutral">
                  {selectedDateSummary ? `${selectedDateSummary.date}` : '未选日期'}
                  {selectedCategory ? ` · ${selectedCategory.categoryName}` : ''}
                </Badge>
              </div>

              <div className="analytics-detail-grid">
                <Card className="analytics-detail-card">
                  <p className="eyebrow">Tasks</p>
                  <h5>任务明细</h5>
                  {detailTasks.length > 0 ? (
                    <div className="analytics-detail-list">
                      {detailTasks.map((task) => (
                        <div key={task.taskId} className="analytics-detail-item">
                          <strong>{task.title}</strong>
                          <span>
                            {task.categoryName} · {task.actualMinutes}/{task.estimatedMinutes} 分钟
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">当前筛选下没有匹配的已完成任务。</p>
                  )}
                </Card>

                <Card className="analytics-detail-card">
                  <p className="eyebrow">Journal</p>
                  <h5>日记明细</h5>
                  {detailJournals.length > 0 ? (
                    <div className="analytics-detail-list">
                      {detailJournals.map((entry) => (
                        <div key={entry.entryId} className="analytics-detail-item">
                          <strong>{entry.title}</strong>
                          <span>
                            {entry.date} · {entry.entryType === 'daily' ? '日报' : '自由笔记'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">选中日期下没有日记条目。</p>
                  )}
                </Card>
              </div>
            </article>
          </div>

          <footer className="analytics-footer-note">
            <span className="analytics-theme-pill">当前主题：{settings?.activeThemeId ?? 'default'}</span>
            <span>
              区间内共记录 {snapshot.totalJournalEntries} 篇日记，最高效分类为
              {snapshot.topCategory?.categoryName ?? '暂无'}。
            </span>
          </footer>
        </>
      ) : null}
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
          {suffix ? <span>{suffix}</span> : null}
        </div>
      </div>
    </article>
  )
}

function DonutChart({
  data,
  total,
  centerLabel,
  onSelectCategory
}: {
  data: ReadonlyArray<{ name: string; value: number; categoryId: string; color: string }>
  total: number
  centerLabel: string
  onSelectCategory: (categoryId: string) => void
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
            const fraction = total > 0 ? item.value / total : 0
            const dash = circumference * fraction
            const offset = -cumulative * circumference
            cumulative += fraction

            return (
              <circle
                key={item.categoryId}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="26"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                onClick={() => onSelectCategory(item.categoryId)}
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
  data,
  selectedDate,
  onSelectDate
}: {
  data: ReadonlyArray<{ date: string; label: string; completedTasks: number }>
  selectedDate: string | null
  onSelectDate: (date: string) => void
}): ReactElement {
  const width = 420
  const height = 280
  const padding = { top: 18, right: 18, bottom: 38, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(1, ...data.map((item) => item.completedTasks))
  const ySteps = 4

  const points = data.map((item, index) => {
    const x = padding.left + (chartWidth / Math.max(data.length - 1, 1)) * index
    const y = padding.top + chartHeight - (item.completedTasks / maxValue) * chartHeight
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
            key={point.date}
            x={point.x}
            y={height - 12}
            textAnchor="middle"
            className="analytics-axis-label"
          >
            {point.label}
          </text>
        ))}

        <path d={path} className="analytics-line-path" />
        {points.map((point) => (
          <g key={`${point.date}-${point.completedTasks}`} onClick={() => onSelectDate(point.date)}>
            <circle
              cx={point.x}
              cy={point.y}
              r="7"
              className={selectedDate === point.date ? 'analytics-line-dot-ring analytics-line-dot-selected' : 'analytics-line-dot-ring'}
            />
            <circle cx={point.x} cy={point.y} r="3.5" className="analytics-line-dot-core" />
          </g>
        ))}
      </svg>
    </div>
  )
}

function HeatmapGrid({
  data,
  selectedDate,
  onSelectDate
}: {
  data: HeatmapPoint[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}): ReactElement {
  const maxValue = Math.max(1, ...data.map((point) => point.value))

  return (
    <div className="analytics-heatmap-grid">
      {data.map((point) => {
        const intensity = point.value === 0 ? 0.1 : point.value / maxValue
        return (
          <button
            key={`${point.type}-${point.date}`}
            type="button"
            className={selectedDate === point.date ? 'analytics-heatmap-cell active' : 'analytics-heatmap-cell'}
            style={{
              backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(intensity * 70)}%, white)`
            }}
            onClick={() => onSelectDate(point.date)}
            title={`${point.date}: ${point.value}`}
          >
            <span>{point.date.slice(5)}</span>
            <strong>{point.value}</strong>
          </button>
        )
      })}
    </div>
  )
}

function EfficiencyList({
  records
}: {
  records: ReadonlyArray<AnalyticsSnapshot['efficiencyRecords'][number]>
}): ReactElement {
  return (
    <div className="analytics-efficiency-list">
      {records.length > 0 ? (
        records.slice(0, 6).map((record) => (
          <div key={record.taskId} className="analytics-efficiency-item">
            <div>
              <strong>{record.taskTitle}</strong>
              <p className="muted">
                {record.categoryName} · {record.actualMinutes}/{record.estimatedMinutes} 分钟
              </p>
            </div>
            <Badge tone={record.isOvertime ? 'danger' : 'success'}>
              {record.ratio.toFixed(2)}x
            </Badge>
          </div>
        ))
      ) : (
        <p className="muted">当前范围内还没有可计算效率比的已完成任务。</p>
      )}
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

function HeatmapIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 5h4v4H5zM10 5h4v4h-4zM15 5h4v4h-4zM5 10h4v4H5zM10 10h4v4h-4zM15 10h4v4h-4zM5 15h4v4H5zM10 15h4v4h-4zM15 15h4v4h-4z"
        fill="currentColor"
      />
    </svg>
  )
}

function ScaleIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14M7 8h10M6 19h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 8l-3 5h6L7 8zM17 8l-3 5h6l-3-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
