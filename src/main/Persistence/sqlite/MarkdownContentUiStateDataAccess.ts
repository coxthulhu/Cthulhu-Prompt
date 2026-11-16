import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'

/** Cleanup of legacy editor records before tab-session migration. */
export class MarkdownContentUiStateDataAccess {
  /** Prunes editors whose content no longer exists in the workspace. */
  static cleanupWorkspaceMarkdownContentUiState(workspaceId: string, workspaceContentIds: string[]): void {
    /** Content IDs still owned by this workspace. */
    const validIds = new Set(workspaceContentIds)
    for (const contentId of WorkspaceStateDataAccess.listEntityIds(workspaceId, 'markdown-editor')) {
      if (!validIds.has(contentId)) WorkspaceStateDataAccess.delete(workspaceId, 'markdown-editor', contentId)
    }
  }
}
