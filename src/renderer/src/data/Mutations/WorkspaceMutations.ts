import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload,
  MovePromptFolderPayload,
  MovePromptFolderResponsePayload
} from '@shared/Workspace'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getPromptFolderPromptIds } from '../Collections/PromptFolderEntries'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { removePromptFolderDraft } from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { removePromptDraft } from '../UiState/PromptDraftMutations.svelte.ts'
import { removePromptUiState } from '../UiState/PromptUiStateDraftMutations.svelte.ts'
import {
  getSelectedWorkspaceId,
  setSelectedWorkspaceId
} from '../UiState/WorkspaceSelection.svelte.ts'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { buildPromptFolderTreeIndex } from '@shared/PromptFolderTree'
import { folderEntryRef, removeEntry, type EntryRef } from '@shared/OrderContainer'
import type { PromptFolder } from '@shared/PromptFolder'

const collectWorkspacePromptFolders = (workspaceId: string): PromptFolder[] => {
  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) return []

  const folders: PromptFolder[] = []
  const visit = (folderId: string) => {
    const folder = promptFolderCollection.get(folderId)
    if (!folder || folders.some((current) => current.id === folderId)) return
    folders.push(folder)
    for (const entry of folder.entries) if (entry.kind === 'folder') visit(entry.id)
  }
  for (const entry of workspace.entries) visit(entry.id)
  return folders
}

const clearSelectedWorkspaceCollections = (workspaceId: string | null): void => {
  if (!workspaceId) {
    return
  }

  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) {
    return
  }

  for (const { id: promptFolderId } of workspace.entries) {
    const promptFolder = promptFolderCollection.get(promptFolderId)

    if (promptFolder) {
      for (const promptId of getPromptFolderPromptIds(promptFolder)) {
        promptCollection.utils.deleteAuthoritative(promptId)
        removePromptDraft(promptId)
        removePromptUiState(promptId)
      }
    }

    promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
    removePromptFolderDraft(promptFolderId)
  }

  workspaceCollection.utils.deleteAuthoritative(workspaceId)
}

export const createWorkspace = async (
  workspacePath: string,
  workspaceName: string,
  includeExamplePrompts: boolean
): Promise<IpcMutationActionResponse> => {
  // Special-case payload: create-workspace expects command arguments,
  // not a normal  revision mutation payload object.
  return await ipcInvokeWithPayload<IpcMutationActionResponse, CreateWorkspacePayload>(
    'create-workspace',
    {
      workspacePath,
      workspaceName,
      includeExamplePrompts
    }
  )
}

export const closeWorkspace = async (): Promise<void> => {
  const selectedWorkspaceId = getSelectedWorkspaceId()

  try {
    await runLoad(() =>
      ipcInvokeWithPayload<IpcMutationActionResponse, CloseWorkspacePayload>('close-workspace', {})
    )
  } finally {
    // Side effect: clear renderer  workspace state when the workspace closes.
    setSelectedWorkspaceId(null)
    clearSelectedWorkspaceCollections(selectedWorkspaceId)
  }
}

const resolvePromptFolderInsertIndex = (
  entries: readonly EntryRef[],
  previousEntryId: string | null
): number | null => {
  if (previousEntryId === null) {
    return 0
  }

  const previousIndex = entries.findIndex((entry) => entry.id === previousEntryId)
  return previousIndex === -1 ? null : previousIndex + 1
}

export const movePromptFolder = async (
  workspaceId: string,
  promptFolderId: string,
  previousEntryId: string | null,
  destinationParentPromptFolderId: string | null = null
): Promise<void> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  const promptFolder = promptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const treeIndex = buildPromptFolderTreeIndex(workspace, collectWorkspacePromptFolders(workspaceId))
  const sourceParentPromptFolderId =
    treeIndex.get(promptFolderId)?.parentPromptFolderId ?? null
  const sourceParentPromptFolder = sourceParentPromptFolderId
    ? promptFolderCollection.get(sourceParentPromptFolderId)
    : null
  const destinationParentPromptFolder = destinationParentPromptFolderId
    ? promptFolderCollection.get(destinationParentPromptFolderId)
    : null

  if (sourceParentPromptFolderId && !sourceParentPromptFolder) {
    throw new Error('Source parent prompt folder not loaded')
  }

  if (destinationParentPromptFolderId && !destinationParentPromptFolder) {
    throw new Error('Destination parent prompt folder not loaded')
  }

  const isSameParent = sourceParentPromptFolderId === destinationParentPromptFolderId
  const sourceEntries = sourceParentPromptFolder?.entries ?? workspace.entries
  const destinationEntries = isSameParent
    ? removeEntry(sourceEntries, 'folder', promptFolderId)
    : (destinationParentPromptFolder?.entries ?? workspace.entries)
  const insertIndex = resolvePromptFolderInsertIndex(destinationEntries, previousEntryId)

  if (insertIndex === null) {
    throw new Error('Previous entry not found')
  }

  const nextDestinationEntries = [...destinationEntries]
  nextDestinationEntries.splice(insertIndex, 0, folderEntryRef(promptFolderId))
  await runRevisionMutation<MovePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      if (sourceParentPromptFolderId === null && destinationParentPromptFolderId === null) {
        collections.workspace.update(workspaceId, (draft) => {
          draft.entries = [...nextDestinationEntries]
        })
        return
      }

      if (isSameParent && sourceParentPromptFolderId) {
        collections.promptFolder.update(sourceParentPromptFolderId, (draft) => {
          draft.entries = [...nextDestinationEntries]
        })
        return
      }

      if (sourceParentPromptFolderId) {
        collections.promptFolder.update(sourceParentPromptFolderId, (draft) => {
          draft.entries = removeEntry(draft.entries, 'folder', promptFolderId)
        })
      } else {
        collections.workspace.update(workspaceId, (draft) => {
          draft.entries = removeEntry(draft.entries, 'folder', promptFolderId)
        })
      }

      if (destinationParentPromptFolderId) {
        collections.promptFolder.update(destinationParentPromptFolderId, (draft) => {
          draft.entries = [...nextDestinationEntries]
        })
      } else {
        collections.workspace.update(workspaceId, (draft) => {
          draft.entries = [...nextDestinationEntries]
        })
      }

    },
    persistMutations: async ({ entities, invoke }) => {
      return await invoke<{ payload: MovePromptFolderPayload }>('move-prompt-folder', {
        payload: {
          workspace: entities.workspace({
            id: workspaceId,
            data: workspace
          }),
          sourceParentPromptFolder: sourceParentPromptFolderId
            ? entities.promptFolder({
                id: sourceParentPromptFolderId,
                data: sourceParentPromptFolder!
              })
            : null,
          destinationParentPromptFolder: destinationParentPromptFolderId
            ? entities.promptFolder({
                id: destinationParentPromptFolderId,
                data: destinationParentPromptFolder!
              })
            : null,
          promptFolderId,
          previousEntryId
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      workspaceCollection.utils.upsertAuthoritative(payload.workspace)
      promptFolderCollection.utils.upsertManyAuthoritative(payload.promptFolders)
    },
    conflictMessage: 'Prompt folder move conflict'
  })
}
