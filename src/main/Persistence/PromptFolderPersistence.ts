import * as path from 'path'
import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  copyPromptFolderSettings,
  type CategoryOrder,
  type PromptFolder,
  type PromptFolderSettings,
  type PromptTemplateFolderSettings
} from '@shared/PromptFolder'
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
  readJsonFile,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'
import {
  resolveCompletedPromptFolderName,
  resolveCategoriesDirectoryPath,
  resolvePromptFolderCategoryOrderPath,
  resolvePromptFolderInfoDirectoryPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderPath,
  resolvePromptFolderSettingsTextPath,
  resolvePromptFolderStorageName
} from './PromptPersistencePaths'
import { getFs } from '../fs-provider'
import {
  readPromptFolderCategoryOrder,
  readPromptStemByPromptId
} from '../DataAccess/WorkspaceReads'

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

const fromPromptFolderInfoFile = (
  persistedInfo: PromptFolderInfoFile,
  folderName: string,
  completedPromptIds: string[],
  categoryOrder: CategoryOrder,
  settings: PromptFolderSettings
): PromptFolder => {
  const baseFolder = {
    id: persistedInfo.folderId,
    folderName,
    displayName: persistedInfo.displayName,
    completedPromptIds,
    categoryOrder
  }

  return persistedInfo.kind === 'template'
    ? {
        ...baseFolder,
        kind: 'template',
        settings: settings as PromptTemplateFolderSettings
      }
    : {
        ...baseFolder,
        kind: 'prompt',
        settings
      }
}

const readOptionalTextFile = (filePath: string): string | null => {
  const fs = getFs()
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null
}

export const promptFolderPersistence: PersistenceLayer<
  PromptFolder,
  PromptFolderPersistenceFields
> = {
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
    /** Target root's FolderOrder path, used only by root prompt or template folders. */
    const categoryOrderPath = resolvePromptFolderCategoryOrderPath(
      workspacePath,
      stagingRelativePath,
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
    // Root prompt folders own the Active order metadata and the shared Completed directory.
    const isPromptRoot = kind === 'prompt' && !/[\\/]/.test(stagingRelativePath)
    const activeInfoDirectoryPath = isPromptRoot
      ? path.dirname(categoryOrderPath)
      : null
    const completedDirectoryPath = isPromptRoot
      ? resolvePromptFolderPath(
          workspacePath,
          resolveCompletedPromptFolderName(stagingRelativePath, kind),
          kind
        )
      : null
    /** Whether the committed target owns root-only category persistence. */
    const isTargetRoot = !/[\\/]/.test(targetRelativePath)
    const categoriesDirectoryPath = isTargetRoot
      ? resolveCategoriesDirectoryPath(workspacePath, stagingRelativePath, kind)
      : null
    const activeInfoDirectoryAlreadyExists = activeInfoDirectoryPath
      ? fs.existsSync(activeInfoDirectoryPath)
      : true
    const completedDirectoryAlreadyExists = completedDirectoryPath
      ? fs.existsSync(completedDirectoryPath)
      : true
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
    if (activeInfoDirectoryPath) fs.mkdirSync(activeInfoDirectoryPath, { recursive: true })
    if (completedDirectoryPath) fs.mkdirSync(completedDirectoryPath, { recursive: true })
    if (categoriesDirectoryPath) fs.mkdirSync(categoriesDirectoryPath, { recursive: true })

    /** Staged FolderOrder update for a target root folder. */
    const categoryOrderChange = isTargetRoot
      ? (() => {
          /** Temporary JSON path committed atomically with the root folder. */
          const tempPath = resolveTempPath(categoryOrderPath)
          writeJsonFile(tempPath, toPromptFolderCategoryOrderFile(after.data.categoryOrder))
          return createStagedFileUpsert(categoryOrderPath, tempPath)
        })()
      : null
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
      ...(categoryOrderChange ? [categoryOrderChange] : []),
      createStagedFileUpsert(infoPath, infoTempPath),
      ...settingsTextChanges,
      createStagedEnsureDirectory(folderPath, !folderAlreadyExists),
      createStagedEnsureDirectory(infoDirectoryPath, !infoDirectoryAlreadyExists)
    ]

    if (activeInfoDirectoryPath) {
      stagedChanges.push(
        createStagedEnsureDirectory(
          activeInfoDirectoryPath,
          !activeInfoDirectoryAlreadyExists
        )
      )
    }
    if (completedDirectoryPath) {
      stagedChanges.push(
        createStagedEnsureDirectory(completedDirectoryPath, !completedDirectoryAlreadyExists)
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
  commitChanges: async (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (persistenceFields) => {
    const { workspacePath, folderName, folderPath, kind } = persistenceFields
    const infoPath = resolvePromptFolderInfoPath(workspacePath, folderPath, kind)
    const fs = getFs()

    if (!fs.existsSync(infoPath)) {
      return null
    }

    const persistedInfo = readJsonFile<PromptFolderInfoFile>(infoPath)
    const completedPromptIds =
      kind === 'prompt' && folderName === folderPath
        ? [
            ...readPromptStemByPromptId(
              workspacePath,
              resolveCompletedPromptFolderName(folderPath, kind)
            ).keys()
          ]
        : []
    /** Root-owned repaired category order. */
    const categoryOrder = readPromptFolderCategoryOrder(workspacePath, folderPath, kind)
    const folderDescription = readOptionalTextFile(
      resolvePromptFolderSettingsTextPath(workspacePath, folderPath, 'folderDescription', kind)
    )
    const folderSettings: PromptFolderSettings = { folderDescription }

    return fromPromptFolderInfoFile(
      persistedInfo,
      folderName,
      completedPromptIds,
      categoryOrder,
      copyPromptFolderSettings(folderSettings)
    )
  }
}
