export type WorkspaceInfoFile = {
  /** Version governing this file and every persisted file in its workspace. */
  schemaVersion: number
  workspaceId: string
  workspaceName: string
}

export type PromptFolderInfoFile = {
  displayName: string
  folderId: string
  kind: 'prompt' | 'template'
}

export type PromptFolderOrderFile = OrderContainer<EntryRef>

/** Root prompt or template category ordering stored in FolderOrder.json. */
export type PromptFolderCategoryOrderFile = import('@shared/PromptFolder').CategoryOrder

/** Root-folder ordering stored independently below Prompts or Templates. */
export type WorkspaceFolderOrderFile = OrderContainer<FolderEntryRef>
import type { EntryRef, FolderEntryRef, OrderContainer } from '@shared/OrderContainer'
