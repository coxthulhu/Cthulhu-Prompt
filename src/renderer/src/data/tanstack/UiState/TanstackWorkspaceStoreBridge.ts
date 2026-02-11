import {
  clearTanstackPromptFolderDraftStore,
  flushTanstackPromptFolderDraftAutosaves
} from './TanstackPromptFolderDraftStore.svelte.ts'
import {
  clearTanstackPromptDraftStore,
  flushTanstackPromptDraftAutosaves
} from './TanstackPromptDraftStore.svelte.ts'
import { flushTanstackSystemSettingsAutosave } from './TanstackSystemSettingsDraftStore.svelte.ts'
import { clearTanstackPromptFolderScreenState } from './TanstackPromptFolderScreenData.svelte.ts'

let currentWorkspacePath: string | null = null
let switchQueue: Promise<void> = Promise.resolve()

export const switchTanstackWorkspaceStoreBridge = async (
  nextWorkspacePath: string | null
): Promise<void> => {
  const task = switchQueue.then(async () => {
    if (currentWorkspacePath === nextWorkspacePath) {
      return
    }

    // Side effect: flush active TanStack drafts before switching to a different workspace.
    await Promise.allSettled([
      flushTanstackPromptFolderDraftAutosaves(),
      flushTanstackPromptDraftAutosaves(),
      flushTanstackSystemSettingsAutosave()
    ])

    currentWorkspacePath = nextWorkspacePath
    // Side effect: reset workspace-scoped draft/screen state after the workspace path changes.
    clearTanstackPromptFolderDraftStore()
    clearTanstackPromptDraftStore()
    clearTanstackPromptFolderScreenState()
  })

  switchQueue = task
  await task
}
