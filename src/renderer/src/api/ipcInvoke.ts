type SuccessEnvelope = {
  success: boolean
  error?: string
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

export async function ipcInvoke<TResponse, TPayload = unknown>(
  channel: string,
  payload?: TPayload
): Promise<TResponse> {
  const ipcRenderer = window.electron?.ipcRenderer

  if (!ipcRenderer?.invoke) {
    throw new IpcInvokeError('IPC renderer is not available', { channel, payload })
  }

  try {
    const result =
      payload === undefined
        ? await ipcRenderer.invoke(channel)
        : await ipcRenderer.invoke(channel, payload)

    const hasConflict =
      typeof result === 'object' &&
      result !== null &&
      'conflict' in result &&
      Boolean((result as { conflict?: boolean }).conflict)

    if (isSuccessEnvelope(result) && !result.success && !hasConflict) {
      throw new IpcInvokeError(result.error ?? 'Unknown IPC error', {
        channel,
        payload,
        response: result
      })
    }

    return result as TResponse
  } catch (error) {
    if (error instanceof IpcInvokeError) {
      throw error
    }

    const message = error instanceof Error ? error.message : 'Unexpected IPC invocation failure'

    throw new IpcInvokeError(message, {
      channel,
      payload,
      cause: error
    })
  }
}
