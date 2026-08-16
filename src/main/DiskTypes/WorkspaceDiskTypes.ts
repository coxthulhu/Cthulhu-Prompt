export type WorkspaceInfoFile = {
  workspaceId: string
  workspaceName: string
}

export type PromptFolderInfoFile = {
  displayName: string
  folderId: string
  kind: 'prompt' | 'template'
}

export type PromptFolderOrderFile = OrderContainer<EntryRef>

/** Root prompt or template category ordering stored in FolderOrderV2.json. */
export type PromptFolderCategoryOrderFile = import('@shared/PromptFolder').CategoryOrder

export type WorkspaceFolderOrderFile = OrderContainer<FolderEntryRef>
import type { EntryRef, FolderEntryRef, OrderContainer } from '@shared/OrderContainer'
