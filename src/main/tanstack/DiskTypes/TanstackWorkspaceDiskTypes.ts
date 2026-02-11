import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'

export type TanstackWorkspaceInfoFile = {
  workspaceId: string
}

export type TanstackPromptFolderConfigFile = {
  foldername: string
  promptFolderId: string
  promptCount: number
  folderDescription: string
}

export type TanstackPromptsFile = {
  metadata?: {
    schemaVersion: number
  }
  prompts: TanstackPrompt[]
}
