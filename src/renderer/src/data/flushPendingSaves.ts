import { flushPromptFolderDraftAutosaves } from '@renderer/data/UiState/PromptFolderDraftStore.svelte.ts'
import { flushPromptDraftAutosaves } from '@renderer/data/UiState/PromptDraftStore.svelte.ts'
import { flushSystemSettingsAutosave } from '@renderer/data/UiState/SystemSettingsDraftStore.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushPromptFolderDraftAutosaves(),
    flushPromptDraftAutosaves(),
    flushSystemSettingsAutosave()
  ])
}
