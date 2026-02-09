import { flushPromptWorkspaceAutosaves } from '@renderer/data/PromptDataStore.svelte.ts'
import { flushTanstackSystemSettingsAutosaves } from '@renderer/data/tanstack/UiState/TanstackSystemSettingsAutosave'
import { flushPromptFolderAutosaves } from '@renderer/data/PromptFolderDataStore.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushPromptFolderAutosaves(),
    flushPromptWorkspaceAutosaves(),
    flushTanstackSystemSettingsAutosaves()
  ])
}
