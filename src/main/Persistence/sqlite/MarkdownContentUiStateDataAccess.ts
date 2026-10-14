import type { MarkdownContentUiState } from '@shared/domain/ui-state/MarkdownContentUiState'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'

/** Machine-local Monaco state shared by prompts and templates. */
export class MarkdownContentUiStateDataAccess {
  /** Reads one editor state and restores its domain identity. */
  static readMarkdownContentUiState(workspaceId: string, contentId: string): MarkdownContentUiState | null {
    /** Monaco JSON remains an opaque string inside the state object. */
    const state = WorkspaceStateDataAccess.read(workspaceId, 'markdown-editor', contentId)
    return state ? { workspaceId, contentId, ...state } : null
  }

  /** Reads only the editors requested by a content query. */
  static readMarkdownContentUiStates(workspaceId: string, contentIds: string[]): MarkdownContentUiState[] {
    return WorkspaceStateDataAccess.readMany(workspaceId, 'markdown-editor', contentIds)
      .map(({ entityId, data }) => ({ workspaceId, contentId: entityId, ...data }))
  }

  /** Saves one editor state without parsing Monaco's private payload. */
  static upsertMarkdownContentUiState(uiState: MarkdownContentUiState): MarkdownContentUiState {
    WorkspaceStateDataAccess.write(uiState.workspaceId, 'markdown-editor', uiState.contentId, {
      editorViewStateJson: uiState.editorViewStateJson
    })
    return { ...uiState }
  }

  /** Removes state when its prompt or template is deleted. */
  static deleteMarkdownContentUiState(workspaceId: string, contentId: string): void {
    WorkspaceStateDataAccess.delete(workspaceId, 'markdown-editor', contentId)
  }

  /** Prunes editors whose content no longer exists in the workspace. */
  static cleanupWorkspaceMarkdownContentUiState(workspaceId: string, workspaceContentIds: string[]): void {
    /** Content IDs still owned by this workspace. */
    const validIds = new Set(workspaceContentIds)
    for (const contentId of WorkspaceStateDataAccess.listEntityIds(workspaceId, 'markdown-editor')) {
      if (!validIds.has(contentId)) this.deleteMarkdownContentUiState(workspaceId, contentId)
    }
  }
}
