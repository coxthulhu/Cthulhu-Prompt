import { flushPromptFolderDraftAutosaves } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
import { flushPromptDraftAutosaves } from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
import { flushSystemSettingsAutosaves } from '@renderer/data/UiState/SystemSettingsAutosave.svelte.ts'
import { flushUserPersistenceAutosaves } from '@renderer/data/UiState/UserPersistenceAutosave.svelte.ts'
import { flushWorkspacePersistenceAutosaves } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'

export const flushPendingSaves = async (): Promise<void> => {
  await Promise.allSettled([
    flushPromptFolderDraftAutosaves(),
    flushPromptDraftAutosaves(),
    flushSystemSettingsAutosaves(),
    flushUserPersistenceAutosaves(),
    flushWorkspacePersistenceAutosaves()
  ])
}
