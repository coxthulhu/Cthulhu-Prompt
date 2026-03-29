import * as path from 'path'

export const PROMPTS_DIRECTORY_NAME = 'Prompts'
export const PROMPT_FOLDER_CONFIG_FILENAME = 'FolderData.json'
export const PROMPT_FOLDER_DESCRIPTION_FILENAME = 'FolderDescription.md'
export const PROMPT_MARKDOWN_FILENAME_SUFFIX = '.md'

export type PromptFilePaths = {
  markdownPath: string
}

export const resolvePromptFolderPath = (workspacePath: string, folderName: string): string => {
  return path.join(workspacePath, PROMPTS_DIRECTORY_NAME, folderName)
}

export const resolvePromptFolderConfigPath = (
  workspacePath: string,
  folderName: string
): string => {
  return path.join(
    resolvePromptFolderPath(workspacePath, folderName),
    PROMPT_FOLDER_CONFIG_FILENAME
  )
}

export const resolvePromptFolderDescriptionPath = (
  workspacePath: string,
  folderName: string
): string => {
  return path.join(
    resolvePromptFolderPath(workspacePath, folderName),
    PROMPT_FOLDER_DESCRIPTION_FILENAME
  )
}

export const resolvePromptPathsFromStem = (folderPath: string, stem: string): PromptFilePaths => {
  return {
    markdownPath: path.join(folderPath, `${stem}${PROMPT_MARKDOWN_FILENAME_SUFFIX}`)
  }
}
