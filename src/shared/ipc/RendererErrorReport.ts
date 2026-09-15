/** IPC channel used to forward renderer error details to the main process. */
export const RENDERER_ERROR_CHANNEL = 'renderer-error'

/** Serializable renderer error details retained by the persistent log. */
export interface RendererErrorReport {
  message: string
  stack: string
}
