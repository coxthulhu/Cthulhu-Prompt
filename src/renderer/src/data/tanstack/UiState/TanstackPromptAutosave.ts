type TanstackPromptAutosaveHandler = () => Promise<void>

const autosaveHandlers = new Set<TanstackPromptAutosaveHandler>()

export const registerTanstackPromptAutosave = (
  handler: TanstackPromptAutosaveHandler
): (() => void) => {
  autosaveHandlers.add(handler)
  return () => {
    autosaveHandlers.delete(handler)
  }
}

export const flushTanstackPromptAutosaves = async (): Promise<void> => {
  const tasks = Array.from(autosaveHandlers, (handler) => handler())
  await Promise.allSettled(tasks)
}
