import type {
  CreatePromptFolderPayload,
  CreatePromptFolderResponsePayload,
  PromptFolder,
  PromptFolderRevisionPayload,
  PromptFolderRevisionResponsePayload,
} from '@shared/PromptFolder'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export const createPromptFolder = async (
  workspaceId: string,
  displayName: string
): Promise<void> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  const {
    displayName: normalizedDisplayName,
    folderName
  } = preparePromptFolderName(displayName)
  const optimisticPromptFolderId = crypto.randomUUID()

  await runRevisionMutation<CreatePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.insert({
        id: optimisticPromptFolderId,
        folderName,
        displayName: normalizedDisplayName,
        promptCount: 0,
        promptIds: [],
        folderDescription: ''
      })
      collections.workspace.update(workspaceId, (draft) => {
        draft.promptFolderIds = [...draft.promptFolderIds, optimisticPromptFolderId]
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return invoke<{ payload: CreatePromptFolderPayload }>('create-prompt-folder', {
        payload: {
          workspace: entities.workspace({
            id: workspaceId,
            data: workspace
          }),
          promptFolderId: optimisticPromptFolderId,
          displayName: normalizedDisplayName
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      workspaceCollection.utils.upsertAuthoritative(payload.workspace)

      if (!payload.promptFolder) {
        return
      }

      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder create conflict'
  })
}

const updatePromptFolder = async (
  promptFolder: PromptFolder
): Promise<void> => {
  if (!promptFolderCollection.get(promptFolder.id)) {
    throw new Error('Prompt folder not loaded')
  }

  await runRevisionMutation<PromptFolderRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.update(promptFolder.id, (draft) => {
        draft.folderName = promptFolder.folderName
        draft.displayName = promptFolder.displayName
        draft.promptCount = promptFolder.promptCount
        draft.promptIds = [...promptFolder.promptIds]
        draft.folderDescription = promptFolder.folderDescription
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return invoke<{ payload: PromptFolderRevisionPayload }>('update-prompt-folder', {
        payload: {
          promptFolder: entities.promptFolder({
            id: promptFolder.id,
            data: promptFolder
          })
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder update conflict'
  })
}

const requirePromptFolder = (promptFolderId: string): PromptFolder => {
  const promptFolder = promptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  return promptFolder
}

export const updatePromptFolderDescription = async (
  promptFolderId: string,
  folderDescription: string
): Promise<void> => {
  const promptFolder = requirePromptFolder(promptFolderId)

  await updatePromptFolder({
    ...promptFolder,
    promptIds: [...promptFolder.promptIds],
    folderDescription
  })
}

export const reorderPromptFolderPrompts = async (
  promptFolderId: string,
  promptIds: string[]
): Promise<void> => {
  const promptFolder = requirePromptFolder(promptFolderId)

  await updatePromptFolder({
    ...promptFolder,
    promptIds: [...promptIds]
  })
}
