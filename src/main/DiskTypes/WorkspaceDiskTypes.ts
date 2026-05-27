export type WorkspaceInfoFile = {
  workspaceId: string
  workspaceName: string
}

export type PromptFolderInfoFile = {
  displayName: string
  promptFolderId: string
}

export type PromptFolderOrderFile = {
  promptIds: string[]
}

export type WorkspacePromptFolderOrderFile = {
  promptFolderIds: string[]
}
