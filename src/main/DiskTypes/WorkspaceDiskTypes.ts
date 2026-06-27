export type WorkspaceInfoFile = {
  workspaceId: string
  workspaceName: string
}

export type PromptFolderInfoFile = {
  displayName: string
  promptFolderId: string
}

export type PromptFolderOrderFile = {
  entryIds: string[]
}

export type WorkspacePromptFolderOrderFile = {
  promptFolderIds: string[]
}
