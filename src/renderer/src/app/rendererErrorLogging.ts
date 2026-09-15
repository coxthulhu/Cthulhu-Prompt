import type { RendererErrorReport } from '@shared/RendererErrorReport'

/** Native console implementation retained so renderer errors remain visible in DevTools. */
const originalConsoleError = console.error.bind(console)

/** Converts one console argument into readable persistent-log text. */
const formatErrorValue = (value: unknown): string => {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  return String(value)
}

/** Combines console arguments into the message written by the main process. */
const formatErrorMessage = (values: unknown[]): string => values.map(formatErrorValue).join(' ')

/** Preserves supplied Error stacks or captures the reporting call site for string-only errors. */
const getErrorStack = (message: string, values: unknown[]): string => {
  /** Complete stacks carried by Error arguments. */
  const errorStacks = values.flatMap((value) =>
    value instanceof Error && value.stack ? [value.stack] : []
  )

  if (errorStacks.length > 0) return errorStacks.join('\n\n')
  return new Error(message).stack ?? message
}

/** Sends serializable renderer error details through the preload bridge. */
const reportRendererError = (values: unknown[]): void => {
  /** Human-readable message shared by console and persistent logging. */
  const message = formatErrorMessage(values)
  /** Structured report sent without cloning Error objects across IPC. */
  const report: RendererErrorReport = {
    message,
    stack: getErrorStack(message, values)
  }

  window.rendererLogging.reportError(report)
}

/** Installs application-lifetime capture for handled and unhandled renderer errors. */
export const initializeRendererErrorLogging = (): void => {
  // Side effect: preserve normal console output while forwarding complete Error stacks.
  console.error = (...values: unknown[]) => {
    originalConsoleError(...values)
    reportRendererError(values)
  }

  // Side effect: forward uncaught synchronous errors without suppressing browser handling.
  window.addEventListener('error', (event) => {
    reportRendererError([event.error ?? event.message])
  })

  // Side effect: forward rejected promises without suppressing browser handling.
  window.addEventListener('unhandledrejection', (event) => {
    reportRendererError([event.reason])
  })
}
