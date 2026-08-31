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
  kind: 'filesystem',
  stageChanges: async (transition) => {
    /** Current category record used to resolve an optional removal path. */
    const before = transition.before
    /** Desired category record used to resolve the target path. */
    const after = transition.after
    if (!before && !after) throw new Error('Category persistence transition is empty')
    /** Existing category path when the entity is already persisted. */
    const currentPath = before
      ? resolveCategoryPathFromStem(
          before.persistenceFields.workspacePath,
          before.persistenceFields.rootFolderName,
          before.persistenceFields.kind,
          before.persistenceFields.categoryStem
        )
      : null
    if (!after) return createPersistenceStageResult([createStagedFileRemove(currentPath!)])

    /** Desired category persistence metadata. */
    const fields = after.persistenceFields

    const stem = buildPromptStem(
      after.data.displayName,
      after.data.id,
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
    writeJsonFile(tempPath, after.data)

    const stagedChanges: FilePersistenceStagedChange[] = []
    if (currentPath && currentPath !== targetPath) {
      stagedChanges.push(createStagedFileRemove(currentPath))
    }
    stagedChanges.push(
      createStagedFileUpsert(targetPath, tempPath),
      createStagedEnsureDirectory(categoriesPath, !directoryAlreadyExists)
    )

    return createPersistenceStageResult(stagedChanges, {
      ...fields,
      categoryStem: stem
    })
  },
  commitChanges: (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: (stagedChange) => {
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
