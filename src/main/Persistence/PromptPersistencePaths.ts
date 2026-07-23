import * as path from 'path'
import {
  PROMPT_FOLDER_SETTINGS_DISK_FILENAMES,
  type PromptFolderKind,
  type PromptFolderSettingsField
} from '@shared/PromptFolder'

export const PROMPTS_DIRECTORY_NAME = 'Prompts'
export const TEMPLATES_DIRECTORY_NAME = 'Templates'
export const WORKSPACE_INFO_FILENAME_SUFFIX = '.cthulhuprompt.json'
export const WORKSPACE_FOLDER_ORDER_FILENAME = 'WorkspaceFolderOrder.json'
export const PROMPT_FOLDER_ORDER_FILENAME = 'FolderOrder.json'
export const PROMPT_FOLDER_INFO_DIRECTORY_NAME = '_FolderInfo'
export const PROMPT_FOLDER_INFO_FILENAME = 'FolderInfo.json'
export const PROMPT_MARKDOWN_FILENAME_SUFFIX = '.prompt.md'
export const PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX = '.template.md'
export const COMPLETED_PROMPTS_FOLDER_NAME = '_Completed'

export const PROMPT_FOLDER_SETTINGS_TEXT_FILENAMES = PROMPT_FOLDER_SETTINGS_DISK_FILENAMES

export type PromptFilePaths = {
  markdownPath: string
}

export const resolvePromptRootDirectoryName = (kind: PromptFolderKind): string =>
  kind === 'prompt' ? PROMPTS_DIRECTORY_NAME : TEMPLATES_DIRECTORY_NAME

export const resolvePromptFolderPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): string => {
  return path.join(workspacePath, resolvePromptRootDirectoryName(kind), folderName)
}

export const resolveCompletedPromptFolderName = (folderName: string): string => {
  return path.join(folderName, COMPLETED_PROMPTS_FOLDER_NAME)
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

export const resolvePromptFolderOrderPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): string => {
  return path.join(
    resolvePromptFolderInfoDirectoryPath(workspacePath, folderName, kind),
    PROMPT_FOLDER_ORDER_FILENAME
  )
}

export const resolveWorkspaceFolderOrderPath = (workspacePath: string): string => {
  return path.join(workspacePath, WORKSPACE_FOLDER_ORDER_FILENAME)
}

export const resolvePromptFolderInfoDirectoryPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): string => {
  return path.join(
    resolvePromptFolderPath(workspacePath, folderName, kind),
    PROMPT_FOLDER_INFO_DIRECTORY_NAME
  )
}

export const resolvePromptFolderInfoPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): string => {
  return path.join(
    resolvePromptFolderInfoDirectoryPath(workspacePath, folderName, kind),
    PROMPT_FOLDER_INFO_FILENAME
  )
}

export const resolvePromptFolderSettingsTextPath = (
  workspacePath: string,
  folderName: string,
  field: PromptFolderSettingsField,
  kind: PromptFolderKind
): string => {
  return path.join(
    resolvePromptFolderInfoDirectoryPath(workspacePath, folderName, kind),
    PROMPT_FOLDER_SETTINGS_TEXT_FILENAMES[field]
  )
}

export const resolvePromptPathsFromStem = (
  folderPath: string,
  stem: string,
  kind: PromptFolderKind
): PromptFilePaths => {
  return {
    markdownPath: path.join(
      folderPath,
      `${stem}${kind === 'prompt' ? PROMPT_MARKDOWN_FILENAME_SUFFIX : PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX}`
    )
  }
}
