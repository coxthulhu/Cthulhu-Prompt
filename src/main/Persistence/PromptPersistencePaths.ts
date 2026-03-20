import * as path from 'path'

const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPT_METADATA_SUFFIX = '.prompt.json'
const PROMPT_MARKDOWN_SUFFIX = '.md'

export type PromptFilePaths = {
  markdownPath: string
  metadataPath: string
}

export const resolvePromptFolderPath = (workspacePath: string, folderName: string): string => {
  return path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName)
}

export const resolvePromptFolderConfigPath = (workspacePath: string, folderName: string): string => {
  return path.join(resolvePromptFolderPath(workspacePath, folderName), PROMPT_FOLDER_CONFIG_FILENAME)
}

export const resolvePromptPathsFromStem = (folderPath: string, stem: string): PromptFilePaths => {
  return {
    markdownPath: path.join(folderPath, `${stem}${PROMPT_MARKDOWN_SUFFIX}`),
    metadataPath: path.join(folderPath, `${stem}${PROMPT_METADATA_SUFFIX}`)
  }
}
