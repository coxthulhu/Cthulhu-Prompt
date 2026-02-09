import { flushPromptWorkspaceAutosaves } from '@renderer/data/PromptDataStore.svelte.ts'
import { flushTanstackSystemSettingsAutosaves } from '@renderer/data/tanstack/UiState/TanstackSystemSettingsAutosave'
import { flushPromptFolderAutosaves } from '@renderer/data/PromptFolderDataStore.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushPromptFolderAutosaves(),
    flushPromptWorkspaceAutosaves(),
    // TODO(tanstack-update-prompt-folder): include `flushTanstackPromptFolderAutosaves()` once
    // prompt folder settings/editors migrate to TanStack prompt folder draft autosaves.
    // flushTanstackPromptFolderAutosaves(),
    // TODO(tanstack-update-prompt): include `flushTanstackPromptAutosaves()` once
    // prompt editors run on TanStack prompt drafts instead of legacy prompt autosaves.
    flushTanstackSystemSettingsAutosaves()
  ])
}
