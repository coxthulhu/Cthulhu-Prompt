export type PromptFolderConfig = {
  foldername: string
  promptFolderId: string
  promptCount: number
  folderDescription: string
}

export const createPromptFolderConfig = (
  foldername: string,
  promptCount: number,
  promptFolderId: string,
  folderDescription: string = ''
): PromptFolderConfig => {
  return { foldername, promptFolderId, promptCount, folderDescription }
}
