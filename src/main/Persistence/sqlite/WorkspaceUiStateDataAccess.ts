import type { Project } from '@shared/domain/workspace/Project'
import { parseWorkspaceScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'

/** Removes stale collection state while retaining valid navigation memories. */
export class WorkspaceUiStateDataAccess {
  /** Prunes both storage scopes for deleted owners and resets invalid navigation. */
  static cleanupWorkspacePromptCollectionUiState(
    workspaceId: string,
    workspaceCollectionIds: string[],
    workspaceCategoryIds: string[],
    projects: Project[]
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
      /** Legacy navigation is imported when this user first opens a project-aware workspace. */
      const state = WorkspaceStateDataAccess.read(workspaceId, 'workspace-navigation', null)
      if (!state) return
      /** Old records lack the per-project map and selected project identity. */
      const legacy = state as typeof state & { lastCollectionId?: string | null }
      state.lastCollectionIdByProject ??= {}
      if (legacy.lastCollectionId) {
        /** Existing selected collection determines ownership even if the default project was renamed. */
        const owner = projects.find((project) => project.collectionEntries.some((entry) => entry.id === legacy.lastCollectionId))
        if (owner && !(owner.id in state.lastCollectionIdByProject)) state.lastCollectionIdByProject[owner.id] = legacy.lastCollectionId
      }
      delete legacy.lastCollectionId
      if (state.selectedScreen === 'project' && state.selectedScreenData && typeof state.selectedScreenData === 'object' && 'promptCollectionId' in state.selectedScreenData && !state.selectedScreenData.projectId) {
        /** Capture selection before callback evaluation so its discriminated shape remains narrowed. */
        const selection = state.selectedScreenData
        selection.projectId = projects.find((project) => project.collectionEntries.some((entry) => entry.id === selection.promptCollectionId))?.id ?? projects[0]?.id ?? ''
      }
      /** Navigation is validated independently of its remembered collections. */
      const selection = parseWorkspaceScreenSelection(state.selectedScreen, state.selectedScreenData)
      if (!selection || (selection.selectedScreen === 'project' &&
        !projects.some((project) => project.id === selection.selectedScreenData.projectId &&
          (!selection.selectedScreenData.promptCollectionId || project.collectionEntries.some((entry) => entry.id === selection.selectedScreenData.promptCollectionId))))) {
        state.selectedScreen = 'home'
        state.selectedScreenData = null
      }
      for (const [projectId, collectionId] of Object.entries(state.lastCollectionIdByProject)) {
        /** Removed projects lose navigation; removed collections fall back to that project's first collection. */
        const project = projects.find((candidate) => candidate.id === projectId)
        if (!project) delete state.lastCollectionIdByProject[projectId]
        else if (collectionId && !project.collectionEntries.some((entry) => entry.id === collectionId)) state.lastCollectionIdByProject[projectId] = null
      }
      WorkspaceStateDataAccess.write(workspaceId, 'workspace-navigation', null, state)
    })
  }
}
