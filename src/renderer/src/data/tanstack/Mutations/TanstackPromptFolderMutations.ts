import type {
  TanstackCreatePromptFolderResponsePayload,
  TanstackCreatePromptFolderRequest,
  TanstackCreatePromptFolderResult
} from '@shared/tanstack/TanstackPromptFolderCreate'
import type { TanstackPromptFolder } from '@shared/tanstack/TanstackPromptFolder'
import type {
  TanstackPromptFolderRevisionResponsePayload,
  TanstackUpdatePromptFolderRevisionRequest,
  TanstackUpdatePromptFolderRevisionResult
} from '@shared/tanstack/TanstackPromptFolderRevision'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { runTanstackRevisionMutation } from '../IpcFramework/TanstackRevisionCollections'
import { tanstackPromptFolderCollection } from '../Collections/TanstackPromptFolderCollection'
import { tanstackWorkspaceCollection } from '../Collections/TanstackWorkspaceCollection'

export const createTanstackPromptFolder = async (
  workspaceId: string,
  displayName: string
): Promise<void> => {
  const workspace = tanstackWorkspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  const {
    displayName: normalizedDisplayName,
    folderName
  } = preparePromptFolderName(displayName)
  const optimisticPromptFolderId = crypto.randomUUID()

  await runTanstackRevisionMutation<TanstackCreatePromptFolderResponsePayload>({
    mutateOptimistically: () => {
      tanstackPromptFolderCollection.insert({
        id: optimisticPromptFolderId,
        folderName,
        displayName: normalizedDisplayName,
        promptCount: 0,
        promptIds: [],
        folderDescription: ''
      })
      tanstackWorkspaceCollection.update(workspaceId, (draft) => {
        draft.promptFolderIds = [...draft.promptFolderIds, optimisticPromptFolderId]
      })
    },
    runMutation: async ({ entities, invoke }) => {
      return invoke<TanstackCreatePromptFolderResult, TanstackCreatePromptFolderRequest>(
        'tanstack-create-prompt-folder',
        {
          payload: {
            workspace: entities.workspace({
              id: workspaceId,
              data: workspace
            }),
            promptFolderId: optimisticPromptFolderId,
            displayName: normalizedDisplayName
          }
        }
      )
    },
    handleSuccessOrConflictResponse: (payload) => {
      tanstackWorkspaceCollection.utils.upsertAuthoritative(payload.workspace)

      if (!payload.promptFolder) {
        return
      }

      tanstackPromptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder create conflict'
  })
}

const updateTanstackPromptFolder = async (
  promptFolder: TanstackPromptFolder
): Promise<void> => {
  if (!tanstackPromptFolderCollection.get(promptFolder.id)) {
    throw new Error('Prompt folder not loaded')
  }

  await runTanstackRevisionMutation<TanstackPromptFolderRevisionResponsePayload>({
    mutateOptimistically: () => {
      tanstackPromptFolderCollection.update(promptFolder.id, (draft) => {
        draft.folderName = promptFolder.folderName
        draft.displayName = promptFolder.displayName
        draft.promptCount = promptFolder.promptCount
        draft.promptIds = [...promptFolder.promptIds]
        draft.folderDescription = promptFolder.folderDescription
      })
    },
    runMutation: async ({ entities, invoke }) => {
      return invoke<
        TanstackUpdatePromptFolderRevisionResult,
        TanstackUpdatePromptFolderRevisionRequest
      >('tanstack-update-prompt-folder', {
        payload: {
          promptFolder: entities.promptFolder({
            id: promptFolder.id,
            data: promptFolder
          })
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      tanstackPromptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder update conflict'
  })
}

const requireTanstackPromptFolder = (promptFolderId: string): TanstackPromptFolder => {
  const promptFolder = tanstackPromptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  return promptFolder
}

export const updateTanstackPromptFolderDescription = async (
  promptFolderId: string,
  folderDescription: string
): Promise<void> => {
  const promptFolder = requireTanstackPromptFolder(promptFolderId)

  await updateTanstackPromptFolder({
    ...promptFolder,
    promptIds: [...promptFolder.promptIds],
    folderDescription
  })
}

export const reorderTanstackPromptFolderPrompts = async (
  promptFolderId: string,
  promptIds: string[]
): Promise<void> => {
  const promptFolder = requireTanstackPromptFolder(promptFolderId)

  await updateTanstackPromptFolder({
    ...promptFolder,
    promptIds: [...promptIds]
  })
}
