import * as path from 'path'

export const PROMPTS_DIRECTORY_NAME = 'Prompts'
export const WORKSPACE_INFO_FILENAME_SUFFIX = '.cthulhuprompt.json'
export const PROMPT_FOLDER_ORDER_FILENAME = 'FolderOrder.json'
export const PROMPT_FOLDER_INFO_DIRECTORY_NAME = '.folderprops'
export const PROMPT_FOLDER_INFO_FILENAME = 'FolderInfo.json'
export const PROMPT_FOLDER_DESCRIPTION_FILENAME = 'Description.md'
export const PROMPT_MARKDOWN_FILENAME_SUFFIX = '.prompt.md'

export type PromptFilePaths = {
  markdownPath: string
}

export const resolvePromptFolderPath = (workspacePath: string, folderName: string): string => {
  return path.join(workspacePath, PROMPTS_DIRECTORY_NAME, folderName)
}

export const resolveWorkspaceInfoPath = (
  workspacePath: string,
  workspaceFileName: string
): string => {
  return path.join(workspacePath, `${workspaceFileName}${WORKSPACE_INFO_FILENAME_SUFFIX}`)
}

export const resolveWorkspacePathFromInfoPath = (workspaceInfoPath: string): string => {
  return path.dirname(workspaceInfoPath)
}

export const isWorkspaceInfoPath = (workspaceInfoPath: string): boolean => {
  return workspaceInfoPath.toLowerCase().endsWith(WORKSPACE_INFO_FILENAME_SUFFIX)
}

export const resolvePromptFolderOrderPath = (workspacePath: string, folderName: string): string => {
  return path.join(resolvePromptFolderPath(workspacePath, folderName), PROMPT_FOLDER_ORDER_FILENAME)
}

export const resolveWorkspacePromptFolderOrderPath = (workspacePath: string): string => {
  return path.join(workspacePath, PROMPTS_DIRECTORY_NAME, PROMPT_FOLDER_ORDER_FILENAME)
}

export const resolvePromptFolderInfoDirectoryPath = (
  workspacePath: string,
  folderName: string
): string => {
  return path.join(
    resolvePromptFolderPath(workspacePath, folderName),
    PROMPT_FOLDER_INFO_DIRECTORY_NAME
  )
}

export const resolvePromptFolderInfoPath = (workspacePath: string, folderName: string): string => {
  return path.join(
    resolvePromptFolderInfoDirectoryPath(workspacePath, folderName),
    PROMPT_FOLDER_INFO_FILENAME
  )
}

export const resolvePromptFolderDescriptionPath = (
  workspacePath: string,
  folderName: string
): string => {
  return path.join(
    resolvePromptFolderInfoDirectoryPath(workspacePath, folderName),
    PROMPT_FOLDER_DESCRIPTION_FILENAME
  )
}

export const resolvePromptPathsFromStem = (folderPath: string, stem: string): PromptFilePaths => {
  return {
    markdownPath: path.join(folderPath, `${stem}${PROMPT_MARKDOWN_FILENAME_SUFFIX}`)
  }
}
