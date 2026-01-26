import {
  flushPromptWorkspaceAutosaves,
  resetPromptDataStoreForWorkspace
} from '@renderer/data/PromptDataStore.svelte.ts'
import { flushSystemSettingsAutosaves } from '@renderer/data/system-settings/systemSettingsAutosave'
import {
  flushPromptFolderRequests,
  flushPromptFolderAutosaves,
  resetPromptFolderDataStoreForWorkspace
} from '@renderer/data/PromptFolderDataStore.svelte.ts'
import { setActiveWorkspacePath } from '@renderer/data/workspace/WorkspaceStore.svelte.ts'

let currentWorkspacePath: string | null = null
let switchQueue: Promise<void> = Promise.resolve()

export const switchWorkspaceStores = async (nextWorkspacePath: string | null): Promise<void> => {
  const task = switchQueue.then(async () => {
    if (currentWorkspacePath === nextWorkspacePath) return

    // Side effect: wait for store requests/autosaves to settle, then reset store state for the new workspace.
    await Promise.allSettled([
      flushPromptFolderRequests(),
      flushPromptFolderAutosaves(),
      flushPromptWorkspaceAutosaves(),
      flushSystemSettingsAutosaves()
    ])

    currentWorkspacePath = nextWorkspacePath
    await setActiveWorkspacePath(nextWorkspacePath)
    resetPromptFolderDataStoreForWorkspace(nextWorkspacePath)
    resetPromptDataStoreForWorkspace(nextWorkspacePath)
  })

  switchQueue = task
  await task
}
