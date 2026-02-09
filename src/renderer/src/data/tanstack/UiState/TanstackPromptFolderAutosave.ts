type TanstackPromptFolderAutosaveHandler = () => Promise<void>

const autosaveHandlers = new Set<TanstackPromptFolderAutosaveHandler>()

export const registerTanstackPromptFolderAutosave = (
  handler: TanstackPromptFolderAutosaveHandler
): (() => void) => {
  autosaveHandlers.add(handler)
  return () => {
    autosaveHandlers.delete(handler)
  }
}

export const flushTanstackPromptFolderAutosaves = async (): Promise<void> => {
  const tasks = Array.from(autosaveHandlers, (handler) => handler())
  await Promise.allSettled(tasks)
}
