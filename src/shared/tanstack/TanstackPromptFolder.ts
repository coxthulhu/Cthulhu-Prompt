export interface TanstackPromptFolderData {
  folderName: string
  displayName: string
  promptCount: number
  promptIds: string[]
  folderDescription: string
}

export type TanstackPromptFolderRecord = TanstackPromptFolderData & {
  id: string
}
