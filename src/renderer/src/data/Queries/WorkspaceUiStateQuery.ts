import {
  createAccordionUiStateKey,
  createCategoryDescriptionEditorUiStateKey,
  createWorkspacePromptFolderUiStateKey,
  LOAD_WORKSPACE_UI_STATE_CHANNEL,
  type LoadWorkspaceUiStateRequest,
  type LoadWorkspaceUiStateResult
} from '@shared/UiState'
import { accordionUiStateCollection } from '../Collections/AccordionUiStateCollection'
import { categoryDescriptionEditorUiStateCollection } from '../Collections/CategoryDescriptionEditorUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '../Collections/WorkspacePromptFolderUiStateCollection'
import { workspaceUiStateCollection } from '../Collections/WorkspaceUiStateCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'

/** Loads and reconciles every split UI-state collection for one selected workspace. */
export const loadWorkspaceUiState = async (workspaceId: string): Promise<void> => {
  /** Authoritative workspace UI-state snapshot response. */
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspaceUiStateResult, LoadWorkspaceUiStateRequest>(
      LOAD_WORKSPACE_UI_STATE_CHANNEL,
      { workspaceId }
    )
  )
  /** Authoritative prompt-folder UI-state keys returned for this workspace. */
  const promptFolderIds = new Set(result.workspacePromptFolderUiStates.map((entry) => entry.id))
  /** Authoritative accordion UI-state keys returned for this workspace. */
  const accordionIds = new Set(result.accordionUiStates.map((entry) => entry.id))
  /** Authoritative category-editor UI-state keys returned for this workspace. */
  const categoryEditorIds = new Set(
    result.categoryDescriptionEditorUiStates.map((entry) => entry.id)
  )
  /** Previously loaded prompt-folder rows absent from the authoritative response. */
  const removedPromptFolderIds = workspacePromptFolderUiStateCollection.toArray.flatMap(
    (record) => {
      /** Composite collection key for one previously loaded owner record. */
      const id = createWorkspacePromptFolderUiStateKey(
        record.workspaceId,
        record.contentOwnerId
      )
      return record.workspaceId === workspaceId && !promptFolderIds.has(id) ? [id] : []
    }
  )
  /** Previously loaded accordion rows absent from the authoritative response. */
  const removedAccordionIds = accordionUiStateCollection.toArray.flatMap((record) => {
    /** Composite collection key for one previously loaded accordion record. */
    const id = createAccordionUiStateKey(record.workspaceId, record.persistenceId)
    return record.workspaceId === workspaceId && !accordionIds.has(id) ? [id] : []
  })
  /** Previously loaded category-editor rows absent from the authoritative response. */
  const removedCategoryEditorIds = categoryDescriptionEditorUiStateCollection.toArray.flatMap(
    (record) => {
      /** Composite collection key for one previously loaded category-editor record. */
      const id = createCategoryDescriptionEditorUiStateKey(
        record.workspaceId,
        record.categoryId
      )
      return record.workspaceId === workspaceId && !categoryEditorIds.has(id) ? [id] : []
    }
  )
  workspacePromptFolderUiStateCollection.utils.deleteManyAuthoritative(removedPromptFolderIds)
  accordionUiStateCollection.utils.deleteManyAuthoritative(removedAccordionIds)
  categoryDescriptionEditorUiStateCollection.utils.deleteManyAuthoritative(
    removedCategoryEditorIds
  )
  workspaceUiStateCollection.utils.upsertAuthoritative(result.workspaceUiState)
  workspacePromptFolderUiStateCollection.utils.upsertManyAuthoritative(
    result.workspacePromptFolderUiStates
  )
  accordionUiStateCollection.utils.upsertManyAuthoritative(result.accordionUiStates)
  categoryDescriptionEditorUiStateCollection.utils.upsertManyAuthoritative(
    result.categoryDescriptionEditorUiStates
  )
}
