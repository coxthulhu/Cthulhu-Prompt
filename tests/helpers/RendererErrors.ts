import type { ConsoleMessage, ElectronApplication, Page } from 'playwright'
import type { TestInfo } from '@playwright/test'

/** One captured renderer failure retained in the test report. */
export interface RendererErrorEntry {
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

/** Annotation shared by the collector and reporter. */
export const RENDERER_ERROR_ANNOTATION = 'renderer-errors-json'

/** Serialized errors attached to one test result. */
export interface RendererErrorPayload {
  entries: RendererErrorEntry[]
  truncatedCount: number
}

/** Tracks renderer failures for one Electron test and removes its listeners at teardown. */
export function createRendererErrorTracker(electronApp: ElectronApplication, testInfo: TestInfo) {
  /** Failures retained for the current test report. */
  const rendererErrors: RendererErrorEntry[] = []
  /** Number of failures exceeding the existing per-test cap. */
  let truncatedCount = 0
  /** Existing report cap prevents unbounded error output. */
  const maxErrorsPerTest = 10

  /** Records one failure or increments the overflow count. */
  const recordRendererError = (entry: RendererErrorEntry) => {
    if (rendererErrors.length < maxErrorsPerTest) {
      rendererErrors.push(entry)
    } else {
      truncatedCount += 1
    }
  }

  /** Cleanup callbacks for every listener installed by this collector. */
  const trackedListeners: Array<() => void> = []
  /** Pages already subscribed to prevent duplicate error capture. */
  const trackedPages = new WeakSet<Page>()

  /** Subscribes one renderer page to console and uncaught-error reporting. */
  const trackPageForRendererErrors = (page: Page) => {
    if (trackedPages.has(page)) {
      return
    }
    trackedPages.add(page)

    /** Captures only console errors, preserving the existing reporting filter. */
    const handleConsole = (message: ConsoleMessage) => {
      if (message.type() !== 'error') {
        return
      }

      /** Source coordinates reported by Chromium for this console error. */
      const location = message.location()
      recordRendererError({
        kind: 'console',
        level: message.type(),
        message: message.text(),
        pageUrl: page.url(),
        location: {
          url: location?.url,
          lineNumber: location?.lineNumber,
          columnNumber: location?.columnNumber
        },
        timestamp: Date.now()
      })
    }

    /** Captures an uncaught renderer exception with its stack when available. */
    const handlePageError = (error: Error) => {
      recordRendererError({
        kind: 'pageerror',
        message: error?.stack || error?.message || String(error),
        pageUrl: page.url(),
        timestamp: Date.now()
      })
    }

    page.on('console', handleConsole)
    page.on('pageerror', handlePageError)

    trackedListeners.push(() => {
      page.off('console', handleConsole)
      page.off('pageerror', handlePageError)
    })
  }

  /** Subscribes newly created Electron windows immediately. */
  const handleElectronWindow = (page: Page) => {
    trackPageForRendererErrors(page)
  }

  electronApp.on('window', handleElectronWindow)
  trackedListeners.push(() => {
    electronApp.off('window', handleElectronWindow)
  })
  return {
    trackPageForRendererErrors,
    /** Returns a snapshot so callers cannot mutate captured errors. */
    getRendererErrors: () => [...rendererErrors],
    /** Removes expected errors without hiding unrelated failures. */
    removeRendererErrorsContaining: (messagePart: string) => {
      for (let errorIndex = rendererErrors.length - 1; errorIndex >= 0; errorIndex -= 1) {
        if (rendererErrors[errorIndex]?.message.includes(messagePart)) {
          rendererErrors.splice(errorIndex, 1)
        }
      }
    },
    /** Detaches listeners and attaches the existing error payload to the test result. */
    dispose: () => {
      trackedListeners.forEach((dispose) => {
        try {
          dispose()
        } catch {
          // Ignore errors from cleanup
        }
      })

      if (rendererErrors.length > 0 || truncatedCount > 0) {
        /** Existing annotation payload consumed by the custom reporter. */
        const payload = {
          entries: rendererErrors,
          truncatedCount
        }

        testInfo.annotations.push({
          type: RENDERER_ERROR_ANNOTATION,
          description: JSON.stringify(payload)
        })
      }
    }
  }
}
