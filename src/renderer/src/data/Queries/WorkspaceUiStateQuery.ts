import {
  createAccordionUiStateKey,
  createWorkspacePromptCollectionUiStateKey,
  LOAD_WORKSPACE_UI_STATE_CHANNEL,
  type LoadWorkspaceUiStateRequest,
  type LoadWorkspaceUiStateResult
} from '@shared/domain/ui-state/UiState'
import { accordionUiStateCollection } from '@renderer/data/Collections/AccordionUiStateCollection'
import { workspacePromptCollectionUiStateCollection } from '@renderer/data/Collections/WorkspacePromptCollectionUiStateCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { ipcInvokeWithPayload } from '@renderer/data/IpcFramework/IpcRequestInvoke'
import { runLoad } from '@renderer/data/IpcFramework/Load'

/** Loads and reconciles every split UI-state collection for one selected workspace. */
export const loadWorkspaceUiState = async (workspaceId: string): Promise<void> => {
  /** Authoritative workspace UI-state snapshot response. */
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspaceUiStateResult, LoadWorkspaceUiStateRequest>(
      LOAD_WORKSPACE_UI_STATE_CHANNEL,
      { workspaceId }
    )
  )
  /** Authoritative prompt-collection UI-state keys returned for this workspace. */
  const promptCollectionIds = new Set(result.workspacePromptCollectionUiStates.map((entry) => entry.id))
  /** Authoritative accordion UI-state keys returned for this workspace. */
  const accordionIds = new Set(result.accordionUiStates.map((entry) => entry.id))
  /** Previously loaded prompt-collection rows absent from the authoritative response. */
  const removedPromptCollectionIds = workspacePromptCollectionUiStateCollection.toArray.flatMap(
    (record) => {
      /** Composite collection key for one previously loaded owner record. */
      const id = createWorkspacePromptCollectionUiStateKey(
        record.workspaceId,
        record.contentOwnerId
      )
      return record.workspaceId === workspaceId && !promptCollectionIds.has(id) ? [id] : []
    }
  )
  /** Previously loaded accordion rows absent from the authoritative response. */
  const removedAccordionIds = accordionUiStateCollection.toArray.flatMap((record) => {
    /** Composite collection key for one previously loaded accordion record. */
    const id = createAccordionUiStateKey(record.workspaceId, record.persistenceId)
    return record.workspaceId === workspaceId && !accordionIds.has(id) ? [id] : []
  })
  workspacePromptCollectionUiStateCollection.utils.deleteManyAuthoritative(removedPromptCollectionIds)
  accordionUiStateCollection.utils.deleteManyAuthoritative(removedAccordionIds)
  workspaceUiStateCollection.utils.upsertAuthoritative(result.workspaceUiState)
  workspacePromptCollectionUiStateCollection.utils.upsertManyAuthoritative(
    result.workspacePromptCollectionUiStates
  )
  accordionUiStateCollection.utils.upsertManyAuthoritative(result.accordionUiStates)
}
