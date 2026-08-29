import * as fs from 'node:fs'
import * as path from 'node:path'

export type PersistentLogLevel = 'info' | 'warning' | 'error'

export interface PersistentLogEntry {
  level: PersistentLogLevel
  source: string
  message: string
  location?: string
  stack?: string
}

interface PersistentLogWriterOptions {
  maxFileSizeBytes?: number
  retainedFileCount?: number
}

const DEFAULT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const DEFAULT_RETAINED_FILE_COUNT = 5
const MAX_LOG_VALUE_LENGTH = 64 * 1024
const LOG_FILE_NAME = 'cthulhu-prompt.log'

const truncateLogValue = (value: string): string => {
  if (value.length <= MAX_LOG_VALUE_LENGTH) return value
  return `${value.slice(0, MAX_LOG_VALUE_LENGTH)}\n[truncated]`
}

const normalizeMetadataValue = (value: string): string => value.replaceAll(/\s+/g, ' ').trim()

export class PersistentLogWriter {
  readonly currentLogPath: string

  private readonly maxFileSizeBytes: number
  private readonly retainedFileCount: number

  constructor(
    logDirectory: string,
    private readonly appVersion: string,
    options: PersistentLogWriterOptions = {}
  ) {
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES
    this.retainedFileCount = options.retainedFileCount ?? DEFAULT_RETAINED_FILE_COUNT

    if (this.maxFileSizeBytes <= 0) {
      throw new Error('Persistent log maximum file size must be greater than zero.')
    }
    if (!Number.isInteger(this.retainedFileCount) || this.retainedFileCount <= 0) {
      throw new Error('Persistent log retained file count must be a positive integer.')
    }

    fs.mkdirSync(logDirectory, { recursive: true })
    this.currentLogPath = path.join(logDirectory, LOG_FILE_NAME)
  }

  write(entry: PersistentLogEntry): void {
    try {
      const formattedEntry = this.formatEntry(entry)
      this.rotateIfNeeded(Buffer.byteLength(formattedEntry, 'utf8'))
      fs.appendFileSync(this.currentLogPath, formattedEntry, 'utf8')
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error)
      process.stderr.write(`Failed to write Cthulhu Prompt log: ${message}\n`)
    }
  }

  private formatEntry(entry: PersistentLogEntry): string {
    const timestamp = new Date().toISOString()
    const level = entry.level.toUpperCase()
    const source = normalizeMetadataValue(entry.source)
    const version = normalizeMetadataValue(this.appVersion)
    const message = truncateLogValue(entry.message)
    const lines = [
      `${timestamp} ${level} source=${source} appVersion=${version} processId=${process.pid}`,
      message
    ]

    if (entry.location) {
      lines.push(`location=${truncateLogValue(entry.location)}`)
    }
    if (entry.stack && entry.stack !== entry.message) {
      lines.push(truncateLogValue(entry.stack))
    }

    return `${lines.join('\n')}\n\n`
  }

  private rotateIfNeeded(nextEntrySize: number): void {
    if (!fs.existsSync(this.currentLogPath)) return

    const currentSize = fs.statSync(this.currentLogPath).size
    if (currentSize === 0 || currentSize + nextEntrySize <= this.maxFileSizeBytes) return

    if (this.retainedFileCount === 1) {
      fs.unlinkSync(this.currentLogPath)
      return
    }

    const oldestArchivePath = this.getArchivePath(this.retainedFileCount - 1)
    if (fs.existsSync(oldestArchivePath)) {
      fs.unlinkSync(oldestArchivePath)
    }

    for (let archiveIndex = this.retainedFileCount - 2; archiveIndex >= 1; archiveIndex -= 1) {
      const sourcePath = this.getArchivePath(archiveIndex)
      if (fs.existsSync(sourcePath)) {
        fs.renameSync(sourcePath, this.getArchivePath(archiveIndex + 1))
      }
    }

    fs.renameSync(this.currentLogPath, this.getArchivePath(1))
  }

  private getArchivePath(archiveIndex: number): string {
    return path.join(
      path.dirname(this.currentLogPath),
      `cthulhu-prompt.${archiveIndex.toString()}.log`
    )
  }
}
