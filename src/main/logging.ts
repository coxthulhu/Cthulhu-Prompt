import { inspect } from 'node:util'
import { app, type BrowserWindow, type WebContents } from 'electron'
import { PersistentLogWriter, type PersistentLogEntry } from './PersistentLogWriter'

let persistentLogWriter: PersistentLogWriter | null = null
let mainProcessHandlersInstalled = false

const getErrorDetails = (error: unknown): Pick<PersistentLogEntry, 'message' | 'stack'> => {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`,
      stack: error.stack
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  return {
    message: inspect(error, {
      depth: 4,
      maxArrayLength: 20,
      maxStringLength: 8 * 1024,
      breakLength: 120
    })
  }
}

const writePersistentLog = (entry: PersistentLogEntry): void => {
  persistentLogWriter?.write(entry)
}

const getWebContentsLocation = (webContents: WebContents): string | undefined => {
  if (webContents.isDestroyed()) return undefined
  return webContents.getURL() || undefined
}

const installMainProcessHandlers = (): void => {
  if (mainProcessHandlersInstalled) return
  mainProcessHandlersInstalled = true

  process.on('uncaughtExceptionMonitor', (error, origin) => {
    const details = getErrorDetails(error)
    writePersistentLog({
      level: 'error',
      source: 'main-uncaught-exception',
      message: `${origin}: ${details.message}`,
      stack: details.stack
    })
  })

  process.on('unhandledRejection', (reason) => {
    const details = getErrorDetails(reason)
    writePersistentLog({
      level: 'error',
      source: 'main-unhandled-rejection',
      message: details.message,
      stack: details.stack
    })
  })

  app.on('render-process-gone', (_event, webContents, details) => {
    if (details.reason === 'clean-exit') return

    writePersistentLog({
      level: 'error',
      source: 'renderer-process',
      message: `Renderer process ended unexpectedly: reason=${details.reason} exitCode=${details.exitCode.toString()}`,
      location: getWebContentsLocation(webContents)
    })
  })
}

export const initializePersistentLogging = (): void => {
  if (persistentLogWriter) return

  app.setAppLogsPath()
  persistentLogWriter = new PersistentLogWriter(app.getPath('logs'), app.getVersion())
  persistentLogWriter.write({
    level: 'info',
    source: 'main',
    message: 'Application logging initialized.'
  })
  installMainProcessHandlers()
}

export const attachRendererLogging = (window: BrowserWindow): void => {
  const { webContents } = window

  webContents.on('console-message', (event) => {
    if (event.level !== 'warning' && event.level !== 'error') return

    const location = event.sourceId
      ? `${event.sourceId}${event.lineNumber > 0 ? `:${event.lineNumber.toString()}` : ''}`
      : undefined

    writePersistentLog({
      level: event.level,
      source: 'renderer-console',
      message: event.message,
      location
    })
  })

  webContents.on('preload-error', (_event, preloadPath, error) => {
    const details = getErrorDetails(error)
    writePersistentLog({
      level: 'error',
      source: 'renderer-preload',
      message: details.message,
      location: preloadPath,
      stack: details.stack
    })
  })

  webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return

      writePersistentLog({
        level: 'error',
        source: 'renderer-load',
        message: `Renderer failed to load: ${errorDescription} (${errorCode.toString()})`,
        location: validatedURL || undefined
      })
    }
  )
}
