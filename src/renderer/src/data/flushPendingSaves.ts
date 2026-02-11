import { flushTanstackPromptFolderDraftAutosaves } from '@renderer/data/tanstack/UiState/TanstackPromptFolderDraftStore.svelte.ts'
import { flushTanstackPromptDraftAutosaves } from '@renderer/data/tanstack/UiState/TanstackPromptDraftStore.svelte.ts'
import { flushTanstackSystemSettingsAutosave } from '@renderer/data/tanstack/UiState/TanstackSystemSettingsDraftStore.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushTanstackPromptFolderDraftAutosaves(),
    flushTanstackPromptDraftAutosaves(),
    flushTanstackSystemSettingsAutosave()
  ])
}
