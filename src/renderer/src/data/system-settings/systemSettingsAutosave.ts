type SystemSettingsAutosaveHandler = () => Promise<void>

const autosaveHandlers = new Set<SystemSettingsAutosaveHandler>()

export const registerSystemSettingsAutosave = (
  handler: SystemSettingsAutosaveHandler
): (() => void) => {
  autosaveHandlers.add(handler)
  return () => {
    autosaveHandlers.delete(handler)
  }
}

export const flushSystemSettingsAutosaves = async (): Promise<void> => {
  const tasks = Array.from(autosaveHandlers, (handler) => handler())
  await Promise.allSettled(tasks)
}
