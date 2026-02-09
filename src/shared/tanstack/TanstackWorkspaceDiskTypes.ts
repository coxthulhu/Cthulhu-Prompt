import type { TanstackPrompt } from './TanstackPrompt'

export type TanstackWorkspaceInfoFile = {
  workspaceId: string
}

export type TanstackPromptFolderConfigFile = {
  foldername: string
  promptFolderId: string
  promptCount: number
  folderDescription: string
}

export type TanstackPromptFromFile = TanstackPrompt

export type TanstackPromptsFile = {
  metadata?: {
    schemaVersion: number
  }
  prompts: TanstackPromptFromFile[]
}
