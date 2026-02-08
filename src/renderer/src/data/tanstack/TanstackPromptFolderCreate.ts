import type {
  TanstackCreatePromptFolderResponsePayload,
  TanstackCreatePromptFolderRequest,
  TanstackCreatePromptFolderResult
} from '@shared/tanstack/TanstackPromptFolderCreate'
import type { TanstackPromptFolder } from '@shared/tanstack/TanstackPromptFolder'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { runTanstackRevisionMutation } from './TanstackRevisionCollections'
import { tanstackPromptFolderCollection } from './TanstackPromptFolderCollection'
import { tanstackWorkspaceCollection } from './TanstackWorkspaceCollection'

const createOptimisticPromptFolder = (
  promptFolderId: string,
  displayName: string,
  folderName: string
): TanstackPromptFolder => {
  return {
    id: promptFolderId,
    folderName,
    displayName,
    promptCount: 0,
    promptIds: [],
    folderDescription: ''
  }
}

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
      tanstackPromptFolderCollection.insert(
        createOptimisticPromptFolder(optimisticPromptFolderId, normalizedDisplayName, folderName)
      )
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
    handleMutationResponse: (payload) => {
      tanstackWorkspaceCollection.utils.upsertAuthoritative(payload.workspace)

      if (!payload.promptFolder) {
        return
      }

      tanstackPromptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder create conflict'
  })
}
