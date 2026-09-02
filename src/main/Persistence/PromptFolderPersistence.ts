import * as path from 'path'
import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  type CategoryOrder,
  type PromptFolder,
} from '@shared/PromptFolder'
import {
  PROMPT_STATUS_FOLDERS,
  type PromptStatusFolderId
} from '@shared/Prompt'
import type {
  PromptFolderCategoryOrderFile,
  PromptFolderInfoFile
} from '../DiskTypes/WorkspaceDiskTypes'
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
  resolvePromptFolderCategoryOrderPath,
  resolvePromptFolderInfoDirectoryPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderPath,
  resolvePromptFolderSettingsTextPath,
  resolvePromptFolderStorageName,
  resolvePromptStatusFolderName
} from './PromptPersistencePaths'
import { getFs } from '../fs-provider'
import { readPromptFolder } from '../DataAccess/WorkspaceReads'

export type PromptFolderPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  folderPath: string
  kind: PromptFolder['kind']
}

const toPromptFolderInfoFile = (promptFolder: PromptFolder): PromptFolderInfoFile => {
  return {
    displayName: promptFolder.displayName,
    folderId: promptFolder.id,
    kind: promptFolder.kind
  }
}

/** Converts authoritative root category ordering into its disk-file shape. */
const toPromptFolderCategoryOrderFile = (
  categoryOrder: CategoryOrder
): PromptFolderCategoryOrderFile => categoryOrder

export const promptFolderPersistence: PersistenceLayer<
  PromptFolder,
  PromptFolderPersistenceFields
> = {
  kind: 'filesystem',
  stageChanges: async (transition) => {
    /** Current prompt-folder record used to resolve removals and renames. */
    const before = transition.before
    /** Desired prompt-folder record used to resolve target paths and serialized data. */
    const after = transition.after
    if (!before && !after) throw new Error('Prompt-folder persistence transition is empty')
    /** Desired or current fields supplying the workspace and kind. */
    const fields = (after ?? before)!.persistenceFields
    const { workspacePath, folderPath: targetRelativePath, kind } = fields
    /** Existing relative path used while staging an update or removal. */
    const stagingRelativePath = before?.persistenceFields.folderPath ?? targetRelativePath
    const folderPath = resolvePromptFolderPath(
      workspacePath,
      resolvePromptFolderStorageName(stagingRelativePath, kind),
      kind
    )
    const infoDirectoryPath = resolvePromptFolderInfoDirectoryPath(
      workspacePath,
      stagingRelativePath,
      kind
    )
    const infoPath = resolvePromptFolderInfoPath(workspacePath, stagingRelativePath, kind)
    const settingsTextPaths = PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => ({
      field,
      path: resolvePromptFolderSettingsTextPath(workspacePath, stagingRelativePath, field, kind)
    }))
    const isFolderRename = before !== null && stagingRelativePath !== targetRelativePath
    const targetFolderPath = resolvePromptFolderPath(
      workspacePath,
      resolvePromptFolderStorageName(targetRelativePath, kind),
      kind
    )
    const fs = getFs()
    // Root prompt folders own every code-defined status directory.
    const isPromptRoot = kind === 'prompt' && !/[\\/]/.test(stagingRelativePath)
    /** Existing status-directory paths and creation state for a prompt root. */
    const statusDirectories = isPromptRoot
      ? PROMPT_STATUS_FOLDERS.map((statusFolder) => {
          /** Physical directory owned by one registry entry. */
          const directoryPath = resolvePromptFolderPath(
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
    /** Whether the committed target owns root-only category persistence. */
    const isTargetRoot = !/[\\/]/.test(targetRelativePath)
    const categoriesDirectoryPath = isTargetRoot
      ? resolveCategoriesDirectoryPath(workspacePath, stagingRelativePath, kind)
      : null
    const categoriesDirectoryAlreadyExists = categoriesDirectoryPath
      ? fs.existsSync(categoriesDirectoryPath)
      : true

    if (!after) {
      return createPersistenceStageResult([createStagedDirectoryRemove(folderPath)])
    }

    const folderAlreadyExists = fs.existsSync(folderPath)
    const infoDirectoryAlreadyExists = fs.existsSync(infoDirectoryPath)
    // Side effect: create prompt folder metadata directories before staging writes.
    fs.mkdirSync(folderPath, { recursive: true })
    fs.mkdirSync(infoDirectoryPath, { recursive: true })
    for (const statusDirectory of statusDirectories) {
      fs.mkdirSync(statusDirectory.path, { recursive: true })
    }
    if (categoriesDirectoryPath) fs.mkdirSync(categoriesDirectoryPath, { recursive: true })

    /** Staged FolderOrder updates for every independently ordered target layout. */
    const categoryOrderChanges = isTargetRoot
      ? (after.data.kind === 'template'
          ? [
              {
                statusFolderId: undefined,
                categoryOrder: after.data.categoryOrder
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
          /** Canonical order path for one template root or prompt status folder. */
          const categoryOrderPath = resolvePromptFolderCategoryOrderPath(
            workspacePath,
            stagingRelativePath,
            kind,
            statusFolderId
          )
          /** Temporary JSON path committed atomically with the root folder. */
          const tempPath = resolveTempPath(categoryOrderPath)
          fs.mkdirSync(path.dirname(categoryOrderPath), { recursive: true })
          writeJsonFile(tempPath, toPromptFolderCategoryOrderFile(categoryOrder))
          return createStagedFileUpsert(categoryOrderPath, tempPath)
        })
      : []
    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, toPromptFolderInfoFile(after.data))
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
      createStagedEnsureDirectory(folderPath, !folderAlreadyExists),
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

    if (isFolderRename) {
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
    const infoPath = resolvePromptFolderInfoPath(workspacePath, folderPath, kind)
    const fs = getFs()

    if (!fs.existsSync(infoPath)) {
      return null
    }

    return readPromptFolder(workspacePath, folderPath, folderName, kind)
  }
}
