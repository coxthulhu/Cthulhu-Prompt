type SuccessEnvelope = {
  success: boolean
  error?: string
  conflict?: boolean
}

const isSuccessEnvelope = (value: unknown): value is SuccessEnvelope => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('success' in value)) {
    return false
  }

  return typeof (value as { success: unknown }).success === 'boolean'
}

type IpcInvokeErrorOptions = {
  channel: string
  payload?: unknown
  response?: unknown
  cause?: unknown
}

const logIpcError = ({
  channel,
  payload,
  response,
  error
}: {
  channel: string
  payload?: unknown
  response?: unknown
  error: unknown
}): void => {
  console.error('IPC invocation error', {
    channel,
    payload,
    response,
    error
  })
}

const logIpcConflictWarning = ({
  channel,
  error
}: {
  channel: string
  error?: string
}): void => {
  console.warn('IPC conflict response', {
    channel,
    error
  })
}

// Carries IPC context so callers can log channel/payload/response when needed.
export class IpcInvokeError extends Error {
  readonly channel: string
  readonly payload?: unknown
  readonly response?: unknown

  constructor(message: string, options: IpcInvokeErrorOptions) {
    super(message)
    this.name = 'IpcInvokeError'
    this.channel = options.channel
    this.payload = options.payload
    this.response = options.response

    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

export async function runIpcBestEffort(action: () => Promise<void>): Promise<void>
export async function runIpcBestEffort<T>(
  action: () => Promise<T>,
  onError: () => T | Promise<T>
): Promise<T>
export async function runIpcBestEffort<T>(
  action: () => Promise<T>,
  onError?: () => T | Promise<T>
): Promise<T | void> {
  try {
    return await action()
  } catch {
    // Side effect: keep UI flows quiet while IPC failures are logged centrally.
    if (onError) {
      return await onError()
    }
  }
}

export async function ipcInvoke<TResponse, TPayload = unknown>(
  channel: string,
  payload?: TPayload
): Promise<TResponse> {
  const ipcRenderer = window.electron?.ipcRenderer

  if (!ipcRenderer?.invoke) {
    const invokeError = new IpcInvokeError('IPC renderer is not available', { channel, payload })
    logIpcError({
      channel,
      payload,
      error: invokeError
    })
    throw invokeError
  }

  try {
    const result =
      payload === undefined
        ? await ipcRenderer.invoke(channel)
        : await ipcRenderer.invoke(channel, payload)

    if (isSuccessEnvelope(result) && !result.success && result.conflict) {
      logIpcConflictWarning({
        channel,
        error: result.error
      })
    }

    if (isSuccessEnvelope(result) && !result.success && !result.conflict) {
      const invokeError = new IpcInvokeError(result.error ?? 'Unknown IPC error', {
        channel,
        payload,
        response: result
      })
      logIpcError({
        channel,
        payload,
        response: result,
        error: invokeError
      })
      throw invokeError
    }

    return result as TResponse
  } catch (error) {
    if (error instanceof IpcInvokeError) {
      throw error
    }

    const message = error instanceof Error ? error.message : 'Unexpected IPC invocation failure'

    const invokeError = new IpcInvokeError(message, {
      channel,
      payload,
      cause: error
    })
    logIpcError({
      channel,
      payload,
      error: invokeError
    })
    throw invokeError
  }
}
