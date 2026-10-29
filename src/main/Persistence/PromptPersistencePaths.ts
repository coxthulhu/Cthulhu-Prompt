import * as path from 'path'
import {
  PROMPT_COLLECTION_SETTINGS_DISK_FILENAMES,
  type PromptCollectionContentKind,
  type PromptCollectionKind,
  type PromptCollectionSettingsField
} from '@shared/domain/prompt-collection/PromptCollection'
import {
  PROMPT_STATUS_FOLDER_REGISTRY,
  PromptStatusFolderId
} from '@shared/domain/prompt/Prompt'

export const PROMPTS_DIRECTORY_NAME = 'Prompts'
export const TEMPLATES_DIRECTORY_NAME = 'Templates'
export const WORKSPACE_INFO_FILENAME_SUFFIX = '.cthulhuprompt'
/** Filename for category-view ordering owned by a collection. */
export const PROMPT_COLLECTION_CATEGORY_ORDER_FILENAME = 'CategoryOrder.json'
export const PROMPT_COLLECTION_INFO_DIRECTORY_NAME = '_CollectionInfo'
export const PROMPT_COLLECTION_INFO_FILENAME = 'CollectionInfo.json'
/** File extension identifying attached and standalone notes. */
export const NOTE_MARKDOWN_FILENAME_SUFFIX = '.note.md'
export const PROMPT_MARKDOWN_FILENAME_SUFFIX = '.prompt.md'
export const PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX = '.template.md'
/** Canonical directory containing categories owned by one collection. */
export const CATEGORIES_DIRECTORY_NAME = 'Categories'
/** File suffix used by persisted category records. */
export const CATEGORY_FILENAME_SUFFIX = '.category.json'

export const PROMPT_COLLECTION_SETTINGS_TEXT_FILENAMES = PROMPT_COLLECTION_SETTINGS_DISK_FILENAMES

export type PromptFilePaths = {
  markdownPath: string
}

export const resolvePromptRootDirectoryName = (kind: PromptCollectionKind): string =>
  kind === 'template' ? TEMPLATES_DIRECTORY_NAME : PROMPTS_DIRECTORY_NAME

/** Resolves a collection or status directory beneath the selected content library. */
export const resolvePromptDirectoryPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptCollectionKind
): string => {
  return path.join(workspacePath, resolvePromptRootDirectoryName(kind), folderName)
}

/** Maps a prompt collection and stable status-folder identity to its physical directory. */
export const resolvePromptStatusFolderName = (
  collectionFolderName: string,
  statusFolderId: PromptStatusFolderId
): string =>
  path.join(
    collectionFolderName,
    PROMPT_STATUS_FOLDER_REGISTRY[statusFolderId].directoryName
  )

/** Resolves the physical Active status directory within a prompt collection. */
export const resolveActivePromptStatusFolderName = (
  collectionFolderName: string
): string => {
  return resolvePromptStatusFolderName(collectionFolderName, PromptStatusFolderId.Active)
}

// Resolves the physical directory that owns one prompt-collection entity's metadata.
export const resolvePromptCollectionStorageName = (
  folderName: string,
  _kind: PromptCollectionKind
): string => {
  return folderName
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

/** Resolves the collection-owned category ordering file for prompts or templates. */
export const resolvePromptCollectionCategoryOrderPath = (
  workspacePath: string,
  collectionFolderName: string,
  kind: PromptCollectionKind,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): string => {
  /** Prompt collections store metadata below the selected ordered status folder. */
  const orderFolderName =
    resolvePromptStatusFolderName(collectionFolderName, statusFolderId)
  return path.join(
    resolvePromptDirectoryPath(workspacePath, orderFolderName, kind),
    PROMPT_COLLECTION_INFO_DIRECTORY_NAME,
    PROMPT_COLLECTION_CATEGORY_ORDER_FILENAME
  )
}
export const resolvePromptCollectionInfoDirectoryPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptCollectionKind
): string => {
  return path.join(
    resolvePromptDirectoryPath(
      workspacePath,
      resolvePromptCollectionStorageName(folderName, kind),
      kind
    ),
    PROMPT_COLLECTION_INFO_DIRECTORY_NAME
  )
}

export const resolvePromptCollectionInfoPath = (
  workspacePath: string,
  folderName: string,
  kind: PromptCollectionKind
): string => {
  return path.join(
    resolvePromptCollectionInfoDirectoryPath(workspacePath, folderName, kind),
    PROMPT_COLLECTION_INFO_FILENAME
  )
}

export const resolvePromptCollectionSettingsTextPath = (
  workspacePath: string,
  folderName: string,
  field: PromptCollectionSettingsField,
  kind: PromptCollectionKind
): string => {
  return path.join(
    resolvePromptCollectionInfoDirectoryPath(workspacePath, folderName, kind),
    PROMPT_COLLECTION_SETTINGS_TEXT_FILENAMES[field]
  )
}

/** Resolves the category directory owned by one collection prompt or template collection. */
export const resolveCategoriesDirectoryPath = (
  workspacePath: string,
  collectionFolderName: string,
  kind: PromptCollectionKind
): string =>
  path.join(resolvePromptDirectoryPath(workspacePath, collectionFolderName, kind), CATEGORIES_DIRECTORY_NAME)

/** Resolves one category JSON path from its prompt-style filename stem. */
export const resolveCategoryPathFromStem = (
  workspacePath: string,
  collectionFolderName: string,
  kind: PromptCollectionKind,
  stem: string
): string => path.join(resolveCategoriesDirectoryPath(workspacePath, collectionFolderName, kind), `${stem}${CATEGORY_FILENAME_SUFFIX}`)

export const resolvePromptPathsFromStem = (
  folderPath: string,
  stem: string,
  kind: PromptCollectionContentKind | 'note'
): PromptFilePaths => {
  return {
    markdownPath: path.join(
      folderPath,
      `${stem}${kind === 'note' ? NOTE_MARKDOWN_FILENAME_SUFFIX : kind === 'prompt' ? PROMPT_MARKDOWN_FILENAME_SUFFIX : PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX}`
    )
  }
}
