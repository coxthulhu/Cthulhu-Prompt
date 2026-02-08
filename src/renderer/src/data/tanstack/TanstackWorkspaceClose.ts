import type { TanstackCloseWorkspaceResult } from '@shared/tanstack/TanstackWorkspaceClose'
import { runTanstackLoad } from './TanstackLoad'
import { tanstackIpcInvoke } from './TanstackIpcInvoke'
import { tanstackPromptCollection } from './TanstackPromptCollection'
import { tanstackPromptFolderCollection } from './TanstackPromptFolderCollection'
import { tanstackWorkspaceCollection } from './TanstackWorkspaceCollection'
import {
  getTanstackSelectedWorkspaceId,
  setTanstackSelectedWorkspaceId
} from './TanstackWorkspaceSelection.svelte.ts'

const clearSelectedTanstackWorkspaceCollections = (workspaceId: string | null): void => {
  if (!workspaceId) {
    return
  }

  const workspace = tanstackWorkspaceCollection.get(workspaceId)
  if (!workspace) {
    return
  }

  for (const promptFolderId of workspace.promptFolderIds) {
    const promptFolder = tanstackPromptFolderCollection.get(promptFolderId)

    if (promptFolder) {
      for (const promptId of promptFolder.promptIds) {
        tanstackPromptCollection.utils.deleteAuthoritative(promptId)
      }
    }

    tanstackPromptFolderCollection.utils.deleteAuthoritative(promptFolderId)
  }

  tanstackWorkspaceCollection.utils.deleteAuthoritative(workspaceId)
}

export const closeTanstackWorkspace = async (): Promise<void> => {
  const selectedWorkspaceId = getTanstackSelectedWorkspaceId()

  try {
    await runTanstackLoad(() =>
      tanstackIpcInvoke<TanstackCloseWorkspaceResult>('tanstack-close-workspace')
    )
  } finally {
    // Side effect: clear renderer TanStack workspace state when the workspace closes.
    setTanstackSelectedWorkspaceId(null)
    clearSelectedTanstackWorkspaceCollections(selectedWorkspaceId)
  }
}
