type TanstackSystemSettingsAutosaveHandler = () => Promise<void>

const autosaveHandlers = new Set<TanstackSystemSettingsAutosaveHandler>()

export const registerTanstackSystemSettingsAutosave = (
  handler: TanstackSystemSettingsAutosaveHandler
): (() => void) => {
  autosaveHandlers.add(handler)
  return () => {
    autosaveHandlers.delete(handler)
  }
}

export const flushTanstackSystemSettingsAutosaves = async (): Promise<void> => {
  const tasks = Array.from(autosaveHandlers, (handler) => handler())
  await Promise.allSettled(tasks)
}
