export type PromptFolderConfig = {
  foldername: string
  promptCount: number
  folderDescription: string
}

export const createPromptFolderConfig = (
  foldername: string,
  promptCount: number,
  folderDescription: string = ''
): PromptFolderConfig => {
  return { foldername, promptCount, folderDescription }
}
