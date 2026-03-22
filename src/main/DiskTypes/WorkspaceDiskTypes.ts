export type WorkspaceInfoFile = {
  workspaceId: string
}

export type PromptFolderConfigFile = {
  foldername: string
  promptFolderId: string
  promptCount: number
  folderDescription: string
  promptIds: string[]
}

export type PromptMetadataFile = {
  id: string
  title: string
  creationDate: string
  lastModifiedDate: string
  promptFolderCount: number
}
