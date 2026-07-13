export type WorkspaceInfoFile = {
  workspaceId: string
  workspaceName: string
}

export type PromptFolderInfoFile = {
  displayName: string
  promptFolderId: string
}

export type PromptFolderOrderFile = OrderContainer<EntryRef>

export type WorkspacePromptFolderOrderFile = OrderContainer<FolderEntryRef>
import type { EntryRef, FolderEntryRef, OrderContainer } from '@shared/OrderContainer'
