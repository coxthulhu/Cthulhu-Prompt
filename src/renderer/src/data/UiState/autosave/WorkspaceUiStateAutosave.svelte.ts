import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { submitPacedUpdateTransactionAndWait } from '@renderer/data/IpcFramework/RevisionCollections'

/** Legacy accordion identity used while importing its sections into collection snapshots. */
export const PROMPT_STATUS_ACCORDION_PERSISTENCE_ID = 'sidebar-prompt-statuses'

/** Flushes each workspace's complete tab session before unloading its data. */
export const flushWorkspaceUiStateAutosaves = async (): Promise<void> => {
  await Promise.allSettled(workspaceUiStateCollection.toArray.map((record) =>
    submitPacedUpdateTransactionAndWait(workspaceUiStateCollection.id, record.workspaceId)
  ))
}
