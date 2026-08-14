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

export type WorkspaceFolderOrderFile = OrderContainer<FolderEntryRef>
import type { EntryRef, FolderEntryRef, OrderContainer } from '@shared/OrderContainer'
