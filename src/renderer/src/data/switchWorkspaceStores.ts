import {
  flushPromptWorkspaceAutosaves,
  resetPromptDataStoreForWorkspace
} from '@renderer/data/PromptDataStore.svelte.ts'
import {
  flushPromptFolderRequests,
  resetPromptFolderDataStoreForWorkspace
} from '@renderer/data/PromptFolderDataStore.svelte.ts'

let currentWorkspacePath: string | null = null
let switchQueue: Promise<void> = Promise.resolve()

export const switchWorkspaceStores = async (nextWorkspacePath: string | null): Promise<void> => {
  const task = switchQueue.then(async () => {
    if (currentWorkspacePath === nextWorkspacePath) return

    // Side effect: wait for store requests/autosaves to settle, then reset store state for the new workspace.
    await Promise.allSettled([flushPromptFolderRequests(), flushPromptWorkspaceAutosaves()])

    currentWorkspacePath = nextWorkspacePath
    resetPromptFolderDataStoreForWorkspace(nextWorkspacePath)
    resetPromptDataStoreForWorkspace(nextWorkspacePath)
  })

  switchQueue = task
  await task
}
