import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import fs from 'node:fs'
import path from 'node:path'

interface RendererErrorEntry {
  kind: 'console' | 'pageerror'
  level?: string
  message: string
  pageUrl?: string
  location?: {
    url?: string
    lineNumber?: number
    columnNumber?: number
  }
  timestamp: number
}

interface RendererErrorPayload {
  entries: RendererErrorEntry[]
  truncatedCount: number
}

const RENDERER_ERROR_ANNOTATION = 'renderer-errors-json'
const REPORT_FILE = path.resolve(process.cwd(), 'test-results', 'renderer-errors.txt')

class RendererErrorReporter implements Reporter {
  onBegin() {
    // Reset the report file at the start of each run.
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true })
    fs.writeFileSync(REPORT_FILE, '')
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const annotation = result.annotations.find((entry) => entry.type === RENDERER_ERROR_ANNOTATION)
    if (!annotation?.description) {
      return
    }

    const payload = JSON.parse(annotation.description) as RendererErrorPayload
    if (!payload.entries.length && payload.truncatedCount === 0) {
      return
    }

    const lines: string[] = []
    lines.push(`[${result.startTime.toISOString()}] ${test.titlePath().join(' > ')}`)

    payload.entries.forEach((entry) => {
      const label = entry.kind === 'console' ? 'console error' : 'page error'
      lines.push(`${label}: ${entry.message}`)
      if (entry.pageUrl) {
        lines.push(`page: ${entry.pageUrl}`)
      }
      if (entry.location?.url) {
        const lineNumber =
          entry.location.lineNumber === undefined ? '' : `:${entry.location.lineNumber}`
        const columnNumber =
          entry.location.columnNumber === undefined ? '' : `:${entry.location.columnNumber}`
        lines.push(`location: ${entry.location.url}${lineNumber}${columnNumber}`)
      }
    })

    if (payload.truncatedCount > 0) {
      lines.push(`truncated: ${payload.truncatedCount} additional error(s)`)
    }

    lines.push('')
    fs.appendFileSync(REPORT_FILE, `${lines.join('\n')}\n`)
  }
}

export default RendererErrorReporter
