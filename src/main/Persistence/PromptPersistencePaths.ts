import * as path from 'path'
import {
  PROMPT_FOLDER_SETTINGS_DISK_FILENAMES,
  type PromptFolderContentKind,
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
// Canonical directory containing active prompts, subfolders, and active ordering.
export const ACTIVE_PROMPTS_FOLDER_NAME = 'Active'
// Canonical flat directory containing every completed prompt owned by a root.
export const COMPLETED_PROMPTS_FOLDER_NAME = 'Completed'
/** Canonical directory containing categories owned by one root folder. */
export const CATEGORIES_DIRECTORY_NAME = 'Categories'
/** File suffix used by persisted category records. */
export const CATEGORY_FILENAME_SUFFIX = '.category.json'

export const PROMPT_FOLDER_SETTINGS_TEXT_FILENAMES = PROMPT_FOLDER_SETTINGS_DISK_FILENAMES

export type PromptFilePaths = {
  markdownPath: string
}

export const resolvePromptRootDirectoryName = (kind: PromptFolderKind): string =>
  kind === 'template' ? TEMPLATES_DIRECTORY_NAME : PROMPTS_DIRECTORY_NAME

export const resolvePromptFolderPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): string => {
  return path.join(workspacePath, resolvePromptRootDirectoryName(kind), folderName)
}

// Maps a logical prompt-folder path into the canonical active hierarchy.
export const resolveActivePromptFolderName = (
  folderName: string,
  kind: PromptFolderKind
): string => {
  if (kind === 'template') return folderName

  const [rootFolderName, ...subfolderNames] = folderName.split(/[\\/]/)
  return path.join(rootFolderName!, ACTIVE_PROMPTS_FOLDER_NAME, ...subfolderNames)
}

// Maps every logical prompt-folder path to its root folder's flat completed directory.
export const resolveCompletedPromptFolderName = (
  folderName: string,
  kind: PromptFolderKind = 'prompt'
): string => {
  if (kind === 'template') return folderName

  const [rootFolderName] = folderName.split(/[\\/]/)
  return path.join(rootFolderName!, COMPLETED_PROMPTS_FOLDER_NAME)
}

// Resolves the physical directory that owns one prompt-folder entity's metadata.
export const resolvePromptFolderStorageName = (
  folderName: string,
  kind: PromptFolderKind
): string => {
  if (kind === 'template' || !/[\\/]/.test(folderName)) return folderName
  return resolveActivePromptFolderName(folderName, kind)
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
  const orderFolderName =
    kind === 'prompt' ? resolveActivePromptFolderName(folderName, kind) : folderName
  return path.join(
    resolvePromptFolderPath(workspacePath, orderFolderName, kind),
    PROMPT_FOLDER_INFO_DIRECTORY_NAME,
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
    resolvePromptFolderPath(
      workspacePath,
      resolvePromptFolderStorageName(folderName, kind),
      kind
    ),
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

/** Resolves the category directory owned by one root prompt or template folder. */
export const resolveCategoriesDirectoryPath = (
  workspacePath: string,
  rootFolderName: string,
  kind: PromptFolderKind
): string =>
  path.join(resolvePromptFolderPath(workspacePath, rootFolderName, kind), CATEGORIES_DIRECTORY_NAME)

/** Resolves one category JSON path from its prompt-style filename stem. */
export const resolveCategoryPathFromStem = (
  workspacePath: string,
  rootFolderName: string,
  kind: PromptFolderKind,
  stem: string
): string => path.join(resolveCategoriesDirectoryPath(workspacePath, rootFolderName, kind), `${stem}${CATEGORY_FILENAME_SUFFIX}`)

export const resolvePromptPathsFromStem = (
  folderPath: string,
  stem: string,
  kind: PromptFolderContentKind
): PromptFilePaths => {
  return {
    markdownPath: path.join(
      folderPath,
      `${stem}${kind === 'prompt' ? PROMPT_MARKDOWN_FILENAME_SUFFIX : PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX}`
    )
  }
}
