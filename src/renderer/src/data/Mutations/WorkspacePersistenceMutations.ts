import {
  UPDATE_WORKSPACE_PERSISTENCE_CHANNEL,
  type PersistedWorkspaceScreen,
  type WorkspacePersistence,
  type WorkspacePersistenceRevisionResponsePayload
} from '@shared/UserPersistence'
import type { Transaction } from '@tanstack/svelte-db'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { upsertWorkspacePersistenceDraft } from '../UiState/WorkspacePersistenceDraftMutations.svelte.ts'

const readLatestWorkspacePersistenceFromTransaction = (
  transaction: Transaction<any>,
  workspaceId: string
): WorkspacePersistence => {
  return getLatestMutationModifiedRecord(
    transaction,
    workspacePersistenceCollection.id,
    workspaceId,
    () => workspacePersistenceCollection.get(workspaceId)!
  )
}

const handleWorkspacePersistenceSuccessOrConflictResponse = (
  payload: WorkspacePersistenceRevisionResponsePayload
): void => {
  workspacePersistenceCollection.utils.upsertAuthoritative(payload.workspacePersistence)
  upsertWorkspacePersistenceDraft(payload.workspacePersistence.data)
}

export const syncWorkspaceScreenSelection = async (
  workspaceId: string,
  selectedScreen: PersistedWorkspaceScreen,
  selectedPromptFolderId: string | null
): Promise<void> => {
  const normalizedPromptFolderId =
    selectedScreen === 'prompt-folders' ? selectedPromptFolderId : null

  await runRevisionMutation<WorkspacePersistenceRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        draft.selectedScreen = selectedScreen
        draft.selectedPromptFolderId = normalizedPromptFolderId
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        draft.selectedScreen = selectedScreen
        draft.selectedPromptFolderId = normalizedPromptFolderId
      })
    },
    persistMutations: async ({ entities, invoke, transaction }) => {
      const latestWorkspacePersistence = readLatestWorkspacePersistenceFromTransaction(
        transaction,
        workspaceId
      )

      const mutationResult = await invoke(UPDATE_WORKSPACE_PERSISTENCE_CHANNEL, {
        payload: {
          workspacePersistence: entities.workspacePersistence({
            id: workspaceId,
            data: latestWorkspacePersistence
          })
        }
      })

      if (mutationResult.success) {
        workspacePersistenceDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: handleWorkspacePersistenceSuccessOrConflictResponse,
    conflictMessage: 'Workspace persistence update conflict'
  })
}
