import { setActiveWorkspacePath } from '@renderer/data/workspace/WorkspaceStore.svelte.ts'
import { flushTanstackSystemSettingsAutosaves } from './TanstackSystemSettingsAutosave'
import {
  clearTanstackPromptFolderDraftStore,
  flushTanstackPromptFolderDraftAutosaves
} from './TanstackPromptFolderDraftStore.svelte.ts'
import {
  clearTanstackPromptDraftStore,
  flushTanstackPromptDraftAutosaves
} from './TanstackPromptDraftStore.svelte.ts'
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
      flushTanstackSystemSettingsAutosaves()
    ])

    currentWorkspacePath = nextWorkspacePath
    await setActiveWorkspacePath(nextWorkspacePath)
    clearTanstackPromptFolderDraftStore()
    clearTanstackPromptDraftStore()
    clearTanstackPromptFolderScreenState()
  })

  switchQueue = task
  await task
}
