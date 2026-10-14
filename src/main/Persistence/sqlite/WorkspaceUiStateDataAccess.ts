import { parseWorkspaceScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'

/** Removes stale collection state while retaining valid navigation memories. */
export class WorkspaceUiStateDataAccess {
  /** Prunes both storage scopes for deleted owners and resets invalid navigation. */
  static cleanupWorkspacePromptCollectionUiState(
    workspaceId: string,
    workspacePromptTaskCollectionIds: string[],
    workspacePromptTemplateCollectionIds: string[],
    workspaceCategoryIds: string[]
  ): void {
    /** Valid collections for each navigation activity. */
    const tasks = new Set(workspacePromptTaskCollectionIds)
    /** Template collection IDs are independent from task collection IDs. */
    const templates = new Set(workspacePromptTemplateCollectionIds)
    /** Categories and collections both own collection-view state. */
    const owners = new Set([...tasks, ...templates, ...workspaceCategoryIds])
    SqliteDataAccess.runTransaction(() => {
      for (const stateType of ['collection-user', 'collection-machine'] as const) {
        for (const ownerId of WorkspaceStateDataAccess.listEntityIds(workspaceId, stateType)) {
          if (!owners.has(ownerId)) WorkspaceStateDataAccess.delete(workspaceId, stateType, ownerId)
        }
      }
      /** Navigation is validated independently of its remembered collections. */
      const state = WorkspaceStateDataAccess.read(workspaceId, 'workspace-navigation', null)
      if (!state) return
      /** Existing parser rejects malformed or retired screen selections. */
      const selection = parseWorkspaceScreenSelection(state.selectedScreen, state.selectedScreenData)
      if (!selection || (
        (selection.selectedScreen === 'prompt-task-collections' || selection.selectedScreen === 'prompt-template-collections') &&
        selection.selectedScreenData.promptCollectionId &&
        !(selection.selectedScreen === 'prompt-template-collections' ? templates : tasks).has(selection.selectedScreenData.promptCollectionId)
      )) {
        state.selectedScreen = 'home'
        state.selectedScreenData = null
      }
      if (state.lastPromptTaskCollectionId && !tasks.has(state.lastPromptTaskCollectionId)) state.lastPromptTaskCollectionId = null
      if (state.lastPromptTemplateCollectionId && !templates.has(state.lastPromptTemplateCollectionId)) state.lastPromptTemplateCollectionId = null
      WorkspaceStateDataAccess.write(workspaceId, 'workspace-navigation', null, state)
    })
  }
}
