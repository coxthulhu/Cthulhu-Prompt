import * as path from 'path'
import {
  PROMPT_COLLECTION_SETTINGS_FIELDS,
  type CategoryOrder,
  type PromptCollection,
} from '@shared/domain/prompt-collection/PromptCollection'
import {
  getContentStatusFolders,
  type PromptStatusFolderId
} from '@shared/domain/prompt/Prompt'
import type {
  PromptCollectionCategoryOrderFile,
  PromptCollectionInfoFile
} from './workspace/WorkspaceDiskTypes'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedDirectoryRemove,
  createStagedDirectoryRename,
  createStagedEnsureDirectory,
  createStagedFileRemove,
  createStagedFileUpsert,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'
import {
  resolveCategoriesDirectoryPath,
  resolvePromptCollectionCategoryOrderPath,
  resolvePromptCollectionInfoDirectoryPath,
  resolvePromptCollectionInfoPath,
  resolvePromptDirectoryPath,
  resolvePromptCollectionSettingsTextPath,
  resolvePromptCollectionStorageName,
  resolvePromptStatusFolderName
} from './PromptPersistencePaths'
import { getFs } from '../fs-provider'
import { readPromptCollection } from './workspace/WorkspaceReads'

export type PromptCollectionPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  folderPath: string
  kind: PromptCollection['kind']
}

const toPromptCollectionInfoFile = (promptCollection: PromptCollection): PromptCollectionInfoFile => {
  return {
    displayName: promptCollection.displayName,
    collectionId: promptCollection.id,
    kind: promptCollection.kind
  }
}

/** Converts authoritative collection category ordering into its disk-file shape. */
const toPromptCollectionCategoryOrderFile = (
  categoryOrder: CategoryOrder
): PromptCollectionCategoryOrderFile => categoryOrder

export const promptCollectionPersistence: PersistenceLayer<
  PromptCollection,
  PromptCollectionPersistenceFields
> = {
  kind: 'filesystem',
  stageChanges: async (transition) => {
    /** Current prompt-collection record used to resolve removals and renames. */
    const before = transition.before
    /** Desired prompt-collection record used to resolve target paths and serialized data. */
    const after = transition.after
    if (!before && !after) throw new Error('Prompt-collection persistence transition is empty')
    /** Desired or current fields supplying the workspace and kind. */
    const fields = (after ?? before)!.persistenceFields
    const { workspacePath, folderPath: targetRelativePath, kind } = fields
    /** Existing relative path used while staging an update or removal. */
    const stagingRelativePath = before?.persistenceFields.folderPath ?? targetRelativePath
    const folderPath = resolvePromptDirectoryPath(
      workspacePath,
      resolvePromptCollectionStorageName(stagingRelativePath, kind),
      kind
    )
    const infoDirectoryPath = resolvePromptCollectionInfoDirectoryPath(
      workspacePath,
      stagingRelativePath,
      kind
    )
    const infoPath = resolvePromptCollectionInfoPath(workspacePath, stagingRelativePath, kind)
    const settingsTextPaths = PROMPT_COLLECTION_SETTINGS_FIELDS.map((field) => ({
      field,
      path: resolvePromptCollectionSettingsTextPath(workspacePath, stagingRelativePath, field, kind)
    }))
    const isCollectionRename = before !== null && stagingRelativePath !== targetRelativePath
    const targetFolderPath = resolvePromptDirectoryPath(
      workspacePath,
      resolvePromptCollectionStorageName(targetRelativePath, kind),
      kind
    )
    const fs = getFs()
    // prompt collections own every code-defined status directory.
    const isCollectionDirectory = !/[\\/]/.test(stagingRelativePath)
    /** Existing status-directory paths and creation state for a prompt collection. */
    const statusDirectories = isCollectionDirectory
      ? getContentStatusFolders(kind).map((statusFolder) => {
          /** Physical directory owned by one registry entry. */
          const directoryPath = resolvePromptDirectoryPath(
            workspacePath,
            resolvePromptStatusFolderName(stagingRelativePath, statusFolder.id),
            kind
          )
          return {
            path: directoryPath,
            alreadyExists: fs.existsSync(directoryPath)
          }
        })
      : []
    /** Whether the committed target owns collection-only category persistence. */
    const isTargetCollectionDirectory = !/[\\/]/.test(targetRelativePath)
    const categoriesDirectoryPath = isTargetCollectionDirectory
      ? resolveCategoriesDirectoryPath(workspacePath, stagingRelativePath, kind)
      : null
    const categoriesDirectoryAlreadyExists = categoriesDirectoryPath
      ? fs.existsSync(categoriesDirectoryPath)
      : true

    if (!after) {
      return createPersistenceStageResult([createStagedDirectoryRemove(folderPath)])
    }

    const collectionAlreadyExists = fs.existsSync(folderPath)
    const infoDirectoryAlreadyExists = fs.existsSync(infoDirectoryPath)
    // Side effect: create prompt collection metadata directories before staging writes.
    fs.mkdirSync(folderPath, { recursive: true })
    fs.mkdirSync(infoDirectoryPath, { recursive: true })
    for (const statusDirectory of statusDirectories) {
      fs.mkdirSync(statusDirectory.path, { recursive: true })
    }
    if (categoriesDirectoryPath) fs.mkdirSync(categoriesDirectoryPath, { recursive: true })

    /** Staged CategoryOrder updates for every independently ordered target layout. */
    const categoryOrderChanges = isTargetCollectionDirectory
      ? (after.data.kind === 'template'
          ? [
              {
                statusFolderId: 'active' as PromptStatusFolderId,
                categoryOrder: after.data.statusFolders.active.categoryOrder
              }
            ]
          : Object.entries(after.data.statusFolders).flatMap(
              ([statusFolderId, layout]) =>
                layout.ordering === 'category'
                  ? [
                      {
                        statusFolderId: statusFolderId as PromptStatusFolderId,
                        categoryOrder: layout.categoryOrder
                      }
                    ]
                  : []
            )
        ).map(({ statusFolderId, categoryOrder }) => {
          /** Canonical order path for one template collection or prompt status folder. */
          const categoryOrderPath = resolvePromptCollectionCategoryOrderPath(
            workspacePath,
            stagingRelativePath,
            kind,
            statusFolderId
          )
          /** Temporary JSON path committed atomically with the collection. */
          const tempPath = resolveTempPath(categoryOrderPath)
          fs.mkdirSync(path.dirname(categoryOrderPath), { recursive: true })
          writeJsonFile(tempPath, toPromptCollectionCategoryOrderFile(categoryOrder))
          return createStagedFileUpsert(categoryOrderPath, tempPath)
        })
      : []
    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, toPromptCollectionInfoFile(after.data))
    const settingsTextChanges = settingsTextPaths.map(({ field, path }) => {
      const value = after.data.settings[field]
      if (value === null) {
        return createStagedFileRemove(path)
      }

      const tempPath = resolveTempPath(path)
      fs.writeFileSync(tempPath, value, 'utf8')
      return createStagedFileUpsert(path, tempPath)
    })

    const stagedChanges = [
      ...categoryOrderChanges,
      createStagedFileUpsert(infoPath, infoTempPath),
      ...settingsTextChanges,
      createStagedEnsureDirectory(folderPath, !collectionAlreadyExists),
      createStagedEnsureDirectory(infoDirectoryPath, !infoDirectoryAlreadyExists)
    ]

    for (const statusDirectory of statusDirectories) {
      stagedChanges.push(
        createStagedEnsureDirectory(statusDirectory.path, !statusDirectory.alreadyExists)
      )
    }
    if (categoriesDirectoryPath) {
      stagedChanges.push(
        createStagedEnsureDirectory(categoriesDirectoryPath, !categoriesDirectoryAlreadyExists)
      )
    }

    if (isCollectionRename) {
      stagedChanges.push(createStagedDirectoryRename(folderPath, targetFolderPath))
    }

    return createPersistenceStageResult(stagedChanges, fields)
  },
  commitChanges: (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (persistenceFields) => {
    const { workspacePath, folderName, folderPath, kind } = persistenceFields
    const infoPath = resolvePromptCollectionInfoPath(workspacePath, folderPath, kind)
    const fs = getFs()

    if (!fs.existsSync(infoPath)) {
      return null
    }

    return readPromptCollection(workspacePath, folderPath, folderName, kind)
  }
}
