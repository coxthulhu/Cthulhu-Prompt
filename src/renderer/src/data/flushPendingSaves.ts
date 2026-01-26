import { flushPromptWorkspaceAutosaves } from '@renderer/data/PromptDataStore.svelte.ts'
import { flushSystemSettingsAutosaves } from '@renderer/data/system-settings/systemSettingsAutosave'
import { flushPromptFolderAutosaves } from '@renderer/data/PromptFolderDataStore.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushPromptFolderAutosaves(),
    flushPromptWorkspaceAutosaves(),
    flushSystemSettingsAutosaves()
  ])
}
