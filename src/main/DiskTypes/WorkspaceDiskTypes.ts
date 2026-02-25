import type { Prompt } from '@shared/Prompt'

export type WorkspaceInfoFile = {
  workspaceId: string
}

export type PromptFolderConfigFile = {
  foldername: string
  promptFolderId: string
  promptCount: number
  folderDescription: string
}

export type PromptsFile = {
  prompts: Prompt[]
}
