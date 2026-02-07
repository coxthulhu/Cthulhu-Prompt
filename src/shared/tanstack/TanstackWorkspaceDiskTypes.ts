export type TanstackWorkspaceInfoFile = {
  workspaceId: string
}

export type TanstackPromptFolderConfigFile = {
  foldername: string
  promptFolderId: string
  promptCount: number
  folderDescription: string
}

export type TanstackPromptFromFile = {
  id: string
}

export type TanstackPromptsFile = {
  prompts: TanstackPromptFromFile[]
}
