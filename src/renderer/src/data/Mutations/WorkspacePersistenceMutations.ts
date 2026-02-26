import {
  UPDATE_WORKSPACE_PERSISTENCE_CHANNEL,
  toSerializableWorkspacePersistence,
  type PersistedWorkspaceScreen,
  type WorkspacePersistence,
  type WorkspacePersistenceRevisionResponsePayload
} from '@shared/UserPersistence'
import type { Transaction } from '@tanstack/svelte-db'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'
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

type PacedWorkspacePersistenceMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<WorkspacePersistenceRevisionResponsePayload>
>[0]

type PacedWorkspacePersistenceAutosaveUpdateOptions = Pick<
  PacedWorkspacePersistenceMutationOptions,
  'debounceMs' | 'mutateOptimistically'
> & {
  workspaceId: string
}

const createPersistWorkspacePersistenceMutations = (
  workspaceId: string
): PacedWorkspacePersistenceMutationOptions['persistMutations'] => {
  return async ({ entities, invoke, transaction }) => {
    const latestWorkspacePersistence = readLatestWorkspacePersistenceFromTransaction(
      transaction,
      workspaceId
    )
    const serializableWorkspacePersistence =
      toSerializableWorkspacePersistence(latestWorkspacePersistence)

    const mutationResult = await invoke(UPDATE_WORKSPACE_PERSISTENCE_CHANNEL, {
      payload: {
        workspacePersistence: entities.workspacePersistence({
          id: workspaceId,
          data: serializableWorkspacePersistence
        })
      }
    })

    if (mutationResult.success) {
      workspacePersistenceDraftCollection.utils.acceptMutations(transaction)
    }

    return mutationResult
  }
}

export const mutatePacedWorkspacePersistenceAutosaveUpdate = ({
  workspaceId,
  debounceMs,
  mutateOptimistically
}: PacedWorkspacePersistenceAutosaveUpdateOptions): void => {
  mutatePacedRevisionUpdateTransaction<WorkspacePersistenceRevisionResponsePayload>({
    collectionId: workspacePersistenceCollection.id,
    elementId: workspaceId,
    debounceMs,
    mutateOptimistically,
    persistMutations: createPersistWorkspacePersistenceMutations(workspaceId),
    handleSuccessOrConflictResponse: handleWorkspacePersistenceSuccessOrConflictResponse,
    conflictMessage: 'Workspace persistence update conflict'
  })
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
    persistMutations: createPersistWorkspacePersistenceMutations(workspaceId),
    handleSuccessOrConflictResponse: handleWorkspacePersistenceSuccessOrConflictResponse,
    conflictMessage: 'Workspace persistence update conflict'
  })
}
