/** Creates the correlation ID used by Electron test request/reply events. */
export const createTestRequestId = (prefix: string): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
}
