import type { Category } from '@shared/Category'
import type { PromptFolderKind } from '@shared/PromptFolder'
import { buildPromptStem } from '@shared/promptFilename'
import { getFs } from '../fs-provider'
import {
  commitStagedFileChanges,
  createStagedEnsureDirectory,
  createStagedFileRemove,
  createStagedFileUpsert,
  type FilePersistenceStagedChange,
  readJsonFile,
  resolveTempPath,
  revertStagedFileChanges,
  writeJsonFile
} from './FilePersistenceHelpers'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  resolveCategoriesDirectoryPath,
  resolveCategoryPathFromStem
} from './PromptPersistencePaths'

/** Filesystem location and filename state for one category record. */
export type CategoryPersistenceFields = {
  workspaceId: string
  workspacePath: string
  rootPromptFolderId: string
  rootFolderName: string
  kind: PromptFolderKind
  categoryStem: string
  needsFilenameIdSuffix: boolean
}

/** Validates the exact JSON shape used by persisted category files. */
export const isCategory = (value: unknown): value is Category => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === 3 &&
    typeof record.id === 'string' &&
    typeof record.displayName === 'string' &&
    (typeof record.description === 'string' || record.description === null)
  )
}

/** Parses one category JSON file and rejects malformed records. */
export const parseCategoryJson = (fileText: string): Category | null => {
  try {
    const parsed = JSON.parse(fileText) as unknown
    return isCategory(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Revision-aware persistence layer for root-owned category JSON files. */
export const categoryPersistence: PersistenceLayer<Category, CategoryPersistenceFields> = {
  stageChanges: async (change) => {
    const fields = change.persistenceFields
    const currentPath = resolveCategoryPathFromStem(
      fields.workspacePath,
      fields.rootFolderName,
      fields.kind,
      fields.categoryStem
    )

    if (change.type === 'remove') {
      return createPersistenceStageResult([createStagedFileRemove(currentPath)])
    }

    const stem = buildPromptStem(
      change.data.displayName,
      change.data.id,
      fields.needsFilenameIdSuffix
    )
    const categoriesPath = resolveCategoriesDirectoryPath(
      fields.workspacePath,
      fields.rootFolderName,
      fields.kind
    )
    const targetPath = resolveCategoryPathFromStem(
      fields.workspacePath,
      fields.rootFolderName,
      fields.kind,
      stem
    )
    const tempPath = resolveTempPath(targetPath)
    const fs = getFs()
    const directoryAlreadyExists = fs.existsSync(categoriesPath)
    fs.mkdirSync(categoriesPath, { recursive: true })
    writeJsonFile(tempPath, change.data)

    const stagedChanges: FilePersistenceStagedChange[] = []
    if (currentPath !== targetPath) stagedChanges.push(createStagedFileRemove(currentPath))
    stagedChanges.push(
      createStagedFileUpsert(targetPath, tempPath),
      createStagedEnsureDirectory(categoriesPath, !directoryAlreadyExists)
    )

    return createPersistenceStageResult(stagedChanges, {
      ...fields,
      categoryStem: stem
    })
  },
  commitChanges: async (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (fields) => {
    const categoryPath = resolveCategoryPathFromStem(
      fields.workspacePath,
      fields.rootFolderName,
      fields.kind,
      fields.categoryStem
    )
    const fs = getFs()
    if (!fs.existsSync(categoryPath)) return null
    const parsed = readJsonFile<unknown>(categoryPath)
    return isCategory(parsed) ? parsed : null
  }
}
