import { parseWorkspaceScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'

/** Removes stale collection state while retaining valid navigation memories. */
export class WorkspaceUiStateDataAccess {
  /** Prunes both storage scopes for deleted owners and resets invalid navigation. */
  static cleanupWorkspacePromptCollectionUiState(
    workspaceId: string,
    workspaceCollectionIds: string[],
    workspaceCategoryIds: string[]
  ): void {
    /** Valid collections of either kind for project navigation. */
    const collections = new Set(workspaceCollectionIds)
    /** Categories and collections both own collection-view state. */
    const owners = new Set([...collections, ...workspaceCategoryIds])
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
        selection.selectedScreen === 'project' &&
        selection.selectedScreenData.promptCollectionId &&
        !collections.has(selection.selectedScreenData.promptCollectionId)
      )) {
        state.selectedScreen = 'home'
        state.selectedScreenData = null
      }
      if (state.lastCollectionId && !collections.has(state.lastCollectionId)) state.lastCollectionId = null
      WorkspaceStateDataAccess.write(workspaceId, 'workspace-navigation', null, state)
    })
  }
}
