import { flushPromptFolderDraftAutosaves } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
import { flushPromptDraftAutosaves } from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
import { saveSystemSettingsDraftNow } from '@renderer/data/UiState/SystemSettingsAutosave.svelte.ts'
import { flushUserPersistenceAutosaves } from '@renderer/data/UiState/UserPersistenceAutosave.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushPromptFolderDraftAutosaves(),
    flushPromptDraftAutosaves(),
    saveSystemSettingsDraftNow(),
    flushUserPersistenceAutosaves()
  ])
}
