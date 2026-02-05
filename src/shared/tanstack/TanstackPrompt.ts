export interface TanstackPromptData {
  title: string
  creationDate: string
  lastModifiedDate: string
  promptText: string
  promptFolderCount: number
}

export type TanstackPromptRecord = TanstackPromptData & {
  id: string
}
