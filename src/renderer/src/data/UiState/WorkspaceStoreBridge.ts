import {
  clearPromptFolderDraftStore,
  flushPromptFolderDraftAutosaves
} from './PromptFolderDraftMutations.svelte.ts'
import { clearPromptDraftStore, flushPromptDraftAutosaves } from './PromptDraftMutations.svelte.ts'
import { flushSystemSettingsAutosaves } from './SystemSettingsAutosave.svelte.ts'
import { flushWorkspacePersistenceAutosaves } from './WorkspacePersistenceAutosave.svelte.ts'

let currentWorkspacePath: string | null = null
let switchQueue: Promise<void> = Promise.resolve()

export const switchWorkspaceStoreBridge = async (
  nextWorkspacePath: string | null
): Promise<void> => {
  const task = switchQueue.then(async () => {
    if (currentWorkspacePath === nextWorkspacePath) {
      return
    }

    // Side effect: flush active  drafts before switching to a different workspace.
    await Promise.allSettled([
      flushPromptFolderDraftAutosaves(),
      flushPromptDraftAutosaves(),
      flushSystemSettingsAutosaves(),
      flushWorkspacePersistenceAutosaves()
    ])

    currentWorkspacePath = nextWorkspacePath
    // Side effect: reset workspace-scoped draft/screen state after the workspace path changes.
    clearPromptFolderDraftStore()
    clearPromptDraftStore()
  })

  switchQueue = task
  await task
}
