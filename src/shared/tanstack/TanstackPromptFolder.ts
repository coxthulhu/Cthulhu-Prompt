// Field names intentionally match UpdatedPromptFolderData during migration.
export interface TanstackPromptFolder {
  id: string
  folderName: string
  displayName: string
  promptCount: number
  promptIds: string[]
  folderDescription: string
}
