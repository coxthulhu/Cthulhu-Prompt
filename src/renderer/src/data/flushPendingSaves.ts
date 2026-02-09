import { flushTanstackSystemSettingsAutosaves } from '@renderer/data/tanstack/UiState/TanstackSystemSettingsAutosave'
import { flushTanstackPromptFolderDraftAutosaves } from '@renderer/data/tanstack/UiState/TanstackPromptFolderDraftStore.svelte.ts'
import { flushTanstackPromptDraftAutosaves } from '@renderer/data/tanstack/UiState/TanstackPromptDraftStore.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushTanstackPromptFolderDraftAutosaves(),
    flushTanstackPromptDraftAutosaves(),
    flushTanstackSystemSettingsAutosaves()
  ])
}
