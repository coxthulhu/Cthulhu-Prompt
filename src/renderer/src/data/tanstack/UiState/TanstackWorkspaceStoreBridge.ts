import {
  flushPromptFolderRequests,
  resetPromptFolderDataStoreForWorkspace
} from '@renderer/data/PromptFolderDataStore.svelte.ts'
import { resetPromptDataStoreForWorkspace } from '@renderer/data/PromptDataStore.svelte.ts'
import { setActiveWorkspacePath } from '@renderer/data/workspace/WorkspaceStore.svelte.ts'
import { flushTanstackSystemSettingsAutosaves } from './TanstackSystemSettingsAutosave'

let currentWorkspacePath: string | null = null
let switchQueue: Promise<void> = Promise.resolve()

export const switchTanstackWorkspaceStoreBridge = async (
  nextWorkspacePath: string | null
): Promise<void> => {
  const task = switchQueue.then(async () => {
    if (currentWorkspacePath === nextWorkspacePath) {
      return
    }

    // Side effect: wait for in-flight requests/autosaves before rebinding workspace-backed screens.
    await Promise.allSettled([flushPromptFolderRequests(), flushTanstackSystemSettingsAutosaves()])

    currentWorkspacePath = nextWorkspacePath
    await setActiveWorkspacePath(nextWorkspacePath)
    resetPromptFolderDataStoreForWorkspace(nextWorkspacePath)
    resetPromptDataStoreForWorkspace(nextWorkspacePath)
  })

  switchQueue = task
  await task
}
