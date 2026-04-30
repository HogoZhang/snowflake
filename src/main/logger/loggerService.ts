import { appendFile, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { LogEntry, LogFilter } from '@shared/schema'

/**
 * 生成唯一ID
 * 使用时间戳和随机字符串组合，确保ID唯一性
 */
const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/**
 * 日志级别类型定义
 * debug: 调试信息，用于开发调试
 * info: 一般信息，用于记录正常操作
 * warn: 警告信息，用于潜在问题
 * error: 错误信息，用于异常情况
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * 日志级别数值映射
 * 用于日志级别过滤判断，数值越小级别越低
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * 日志服务配置接口
 * @property logDirectory - 日志文件存储目录
 * @property maxFileSize - 最大文件大小（字节）
 * @property maxEntries - 内存中最大缓存条目数
 * @property level - 日志级别，低于该级别的日志将被忽略
 * @property consoleOutput - 是否同时输出到控制台
 */
export interface LoggerConfig {
  logDirectory: string
  maxFileSize: number
  maxEntries: number
  level: LogLevel
  consoleOutput: boolean
}

/**
 * 默认日志配置
 * 默认日志级别为info，最大缓存10000条日志
 */
const DEFAULT_CONFIG: LoggerConfig = {
  logDirectory: '',
  maxFileSize: 10 * 1024 * 1024,
  maxEntries: 10000,
  level: 'info',
  consoleOutput: true
}

/**
 * 日志服务类
 * 提供多级日志记录、文件持久化、控制台输出、日志过滤等功能
 * 使用异步写入链确保日志顺序一致性
 */
export class LoggerService {
  /** 日志服务配置 */
  private config: LoggerConfig
  /** 内存中的日志条目缓存 */
  private entries: LogEntry[] = []
  /** 日志文件完整路径 */
  private logFilePath: string = ''
  /** 异步写入链，用于保证日志写入顺序 */
  private writeChain: Promise<void> = Promise.resolve()

  /**
   * 构造函数
   * @param config - 可选的配置覆盖
   */
  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    if (this.config.logDirectory) {
      this.logFilePath = join(this.config.logDirectory, 'app.log')
    }
  }

  /**
   * 设置日志存储目录
   * @param directory - 目录路径
   */
  setLogDirectory(directory: string): void {
    this.config.logDirectory = directory
    this.logFilePath = join(directory, 'app.log')
  }

  /**
   * 设置日志级别
   * @param level - 日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  /**
   * 设置是否输出到控制台
   * @param enabled - 是否启用
   */
  setConsoleOutput(enabled: boolean): void {
    this.config.consoleOutput = enabled
  }

  /**
   * 判断是否应该记录该级别日志
   * @param level - 待判断的日志级别
   * @returns 是否应该记录
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  /**
   * 创建日志条目
   * @param level - 日志级别
   * @param module - 模块名称
   * @param message - 日志消息
   * @param data - 可选的附加数据
   * @returns 完整的日志条目对象
   */
  private createEntry(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): LogEntry {
    return {
      id: createId(),
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data
    }
  }

  /**
   * 格式化日志条目为字符串
   * 格式：[时间戳] [级别] [模块] 消息 [JSON数据]
   * @param entry - 日志条目
   * @returns 格式化后的字符串
   */
  private formatEntry(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}${dataStr}\n`
  }

  /**
   * 异步写入日志条目
   * 使用Promise链确保写入顺序，同时维护内存缓存
   * @param entry - 日志条目
   */
  private async writeEntry(entry: LogEntry): Promise<void> {
    this.entries.push(entry)

    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries)
    }

    if (!this.logFilePath) {
      return
    }

    const formatted = this.formatEntry(entry)

    this.writeChain = this.writeChain
      .then(() => appendFile(this.logFilePath, formatted, 'utf-8'))
      .catch((error) => {
        console.error('Failed to write log:', error)
      })

    await this.writeChain
  }

  /**
   * 输出日志到控制台
   * 根据日志级别使用不同的console方法
   * @param entry - 日志条目
   */
  private outputToConsole(entry: LogEntry): void {
    if (!this.config.consoleOutput) {
      return
    }

    const prefix = `[${entry.timestamp}] [${entry.module}]`

    switch (entry.level) {
      case 'debug':
        console.debug(`${prefix} ${entry.message}`, entry.data ?? '')
        break
      case 'info':
        console.info(`${prefix} ${entry.message}`, entry.data ?? '')
        break
      case 'warn':
        console.warn(`${prefix} ${entry.message}`, entry.data ?? '')
        break
      case 'error':
        console.error(`${prefix} ${entry.message}`, entry.data ?? '')
        break
    }
  }

  /**
   * 记录调试级别的日志
   * @param module - 模块名称
   * @param message - 日志消息
   * @param data - 可选的附加数据
   */
  async debug(module: string, message: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.shouldLog('debug')) {
      return
    }

    const entry = this.createEntry('debug', module, message, data)
    this.outputToConsole(entry)
    await this.writeEntry(entry)
  }

  /**
   * 记录信息级别的日志
   * @param module - 模块名称
   * @param message - 日志消息
   * @param data - 可选的附加数据
   */
  async info(module: string, message: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.shouldLog('info')) {
      return
    }

    const entry = this.createEntry('info', module, message, data)
    this.outputToConsole(entry)
    await this.writeEntry(entry)
  }

  /**
   * 记录警告级别的日志
   * @param module - 模块名称
   * @param message - 日志消息
   * @param data - 可选的附加数据
   */
  async warn(module: string, message: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.shouldLog('warn')) {
      return
    }

    const entry = this.createEntry('warn', module, message, data)
    this.outputToConsole(entry)
    await this.writeEntry(entry)
  }

  /**
   * 记录错误级别的日志
   * @param module - 模块名称
   * @param message - 日志消息
   * @param data - 可选的附加数据
   */
  async error(module: string, message: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.shouldLog('error')) {
      return
    }

    const entry = this.createEntry('error', module, message, data)
    this.outputToConsole(entry)
    await this.writeEntry(entry)
  }

  /**
   * 获取日志条目（支持过滤）
   * @param filter - 可选的过滤条件（级别、模块、日期范围）
   * @returns 符合条件的日志条目数组
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let result = [...this.entries]

    if (filter) {
      if (filter.levels && filter.levels.length > 0) {
        result = result.filter((entry) => filter.levels!.includes(entry.level))
      }

      if (filter.modules && filter.modules.length > 0) {
        result = result.filter((entry) => filter.modules!.includes(entry.module))
      }

      if (filter.startDate) {
        result = result.filter((entry) => entry.timestamp >= filter.startDate!)
      }

      if (filter.endDate) {
        result = result.filter((entry) => entry.timestamp <= filter.endDate!)
      }
    }

    return result
  }

  /**
   * 从日志文件加载历史日志
   * 解析日志文件格式并重建日志条目
   */
  async loadFromFile(): Promise<void> {
    if (!this.logFilePath) {
      return
    }

    try {
      await stat(this.logFilePath)
      const content = await readFile(this.logFilePath, 'utf-8')

      const entries: LogEntry[] = []
      const lines = content.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        const match = line.match(
          /\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/
        )

        if (match) {
          const [, timestamp, levelStr, module, messagePart] = match
          const level = levelStr.toLowerCase() as LogLevel

          let message = messagePart
          let data: Record<string, unknown> | undefined

          const dataMatch = messagePart.match(/(.+?)\s+(\{.*\})$/)
          if (dataMatch) {
            try {
              data = JSON.parse(dataMatch[2])
              message = dataMatch[1]
            } catch {
              // Invalid JSON, use entire string as message
            }
          }

          entries.push({
            id: createId(),
            timestamp,
            level,
            module,
            message,
            data
          })
        }
      }

      this.entries = entries.slice(-this.config.maxEntries)
    } catch {
      // File doesn't exist yet, that's fine
    }
  }

  /**
   * 清空内存中的日志缓存
   */
  clearLogs(): void {
    this.entries = []
  }
}

/** 全局日志服务单例 */
const globalLogger = new LoggerService()

/**
 * 获取全局日志服务实例
 * @returns 日志服务单例
 */
export const getLogger = (): LoggerService => globalLogger
