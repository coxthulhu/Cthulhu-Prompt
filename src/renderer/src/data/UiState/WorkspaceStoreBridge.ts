import {
  clearPromptFolderDraftStore,
  flushPromptFolderDraftAutosaves
} from './PromptFolderDraftStore.svelte.ts'
import {
  clearPromptDraftStore,
  flushPromptDraftAutosaves
} from './PromptDraftStore.svelte.ts'
import { flushSystemSettingsAutosave } from './SystemSettingsAutosave.svelte.ts'
import { clearPromptFolderScreenState } from './PromptFolderScreenData.svelte.ts'

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
      flushSystemSettingsAutosave()
    ])

    currentWorkspacePath = nextWorkspacePath
    // Side effect: reset workspace-scoped draft/screen state after the workspace path changes.
    clearPromptFolderDraftStore()
    clearPromptDraftStore()
    clearPromptFolderScreenState()
  })

  switchQueue = task
  await task
}
