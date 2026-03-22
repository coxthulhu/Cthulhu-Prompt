import type { PromptPersisted } from '@shared/Prompt'

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

export type PromptMetadataFile = Omit<PromptPersisted, 'promptText'>
