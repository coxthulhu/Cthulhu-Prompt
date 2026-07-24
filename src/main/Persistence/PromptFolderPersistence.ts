import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  copyPromptFolderSettings,
  type AnyPromptFolderSettings,
  type PromptFolder,
  type PromptFolderSettings,
  type PromptTemplateFolderSettings
} from '@shared/PromptFolder'
import type { EntryRef } from '@shared/OrderContainer'
import type { PromptFolderInfoFile, PromptFolderOrderFile } from '../DiskTypes/WorkspaceDiskTypes'
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
  resolvePromptFolderInfoDirectoryPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderOrderPath,
  resolvePromptFolderPath,
  resolvePromptFolderSettingsTextPath
} from './PromptPersistencePaths'
import { getFs } from '../fs-provider'
import { readPromptStemByPromptId } from '../DataAccess/WorkspaceReads'

export type PromptFolderPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  folderPath: string
  previousFolderPath?: string
  kind: PromptFolder['kind']
}

const toPromptFolderInfoFile = (promptFolder: PromptFolder): PromptFolderInfoFile => {
  return {
    displayName: promptFolder.displayName,
    folderId: promptFolder.id,
    kind: promptFolder.kind
  }
}

const toPromptFolderOrderFile = (entries: EntryRef[]): PromptFolderOrderFile => {
  return { entries }
}

const fromPromptFolderInfoFile = (
  persistedInfo: PromptFolderInfoFile,
  folderName: string,
  entries: EntryRef[],
  completedPromptIds: string[],
  settings: AnyPromptFolderSettings
): PromptFolder => {
  const baseFolder = {
    id: persistedInfo.folderId,
    folderName,
    displayName: persistedInfo.displayName,
    entries,
    completedPromptIds
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
        settings: settings as PromptFolderSettings
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
  stageChanges: async (change) => {
    const { workspacePath, folderPath: targetRelativePath, kind } = change.persistenceFields
    const previousFolderPath = change.persistenceFields.previousFolderPath
    const stagingRelativePath = previousFolderPath ?? targetRelativePath
    const folderPath = resolvePromptFolderPath(workspacePath, stagingRelativePath, kind)
    const orderPath = resolvePromptFolderOrderPath(workspacePath, stagingRelativePath, kind)
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
    const isFolderRename =
      previousFolderPath !== undefined && previousFolderPath !== targetRelativePath
    const targetFolderPath = resolvePromptFolderPath(workspacePath, targetRelativePath, kind)

    if (change.type === 'remove') {
      return createPersistenceStageResult([createStagedDirectoryRemove(folderPath)])
    }

    const fs = getFs()
    const folderAlreadyExists = fs.existsSync(folderPath)
    const infoDirectoryAlreadyExists = fs.existsSync(infoDirectoryPath)
    // Side effect: create prompt folder metadata directories before staging writes.
    fs.mkdirSync(folderPath, { recursive: true })
    fs.mkdirSync(infoDirectoryPath, { recursive: true })

    const orderTempPath = resolveTempPath(orderPath)
    writeJsonFile(orderTempPath, toPromptFolderOrderFile(change.data.entries))
    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, toPromptFolderInfoFile(change.data))
    const settingsTextChanges = settingsTextPaths.map(({ field, path }) => {
      const value =
        change.data.kind === 'template' && field !== 'folderDescription'
          ? null
          : change.data.settings[field as keyof typeof change.data.settings]
      if (value === null) {
        return createStagedFileRemove(path)
      }

      const tempPath = resolveTempPath(path)
      fs.writeFileSync(tempPath, value, 'utf8')
      return createStagedFileUpsert(path, tempPath)
    })

    const stagedChanges = [
      createStagedFileUpsert(orderPath, orderTempPath),
      createStagedFileUpsert(infoPath, infoTempPath),
      ...settingsTextChanges,
      createStagedEnsureDirectory(folderPath, !folderAlreadyExists),
      createStagedEnsureDirectory(infoDirectoryPath, !infoDirectoryAlreadyExists)
    ]

    if (isFolderRename) {
      stagedChanges.push(createStagedDirectoryRename(folderPath, targetFolderPath))
    }

    const { previousFolderPath: _previousFolderPath, ...nextPersistenceFields } =
      change.persistenceFields

    return createPersistenceStageResult(stagedChanges, nextPersistenceFields)
  },
  commitChanges: async (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (persistenceFields) => {
    const { workspacePath, folderName, folderPath, kind } = persistenceFields
    const orderPath = resolvePromptFolderOrderPath(workspacePath, folderPath, kind)
    const infoPath = resolvePromptFolderInfoPath(workspacePath, folderPath, kind)
    const fs = getFs()

    if (!fs.existsSync(orderPath) || !fs.existsSync(infoPath)) {
      return null
    }

    const persistedInfo = readJsonFile<PromptFolderInfoFile>(infoPath)
    const entries = [...readJsonFile<PromptFolderOrderFile>(orderPath).entries]
    const completedPromptIds =
      kind === 'prompt'
        ? [
            ...readPromptStemByPromptId(
              workspacePath,
              resolveCompletedPromptFolderName(folderPath)
            ).keys()
          ]
        : []
    const folderDescription = readOptionalTextFile(
      resolvePromptFolderSettingsTextPath(workspacePath, folderPath, 'folderDescription', kind)
    )
    const folderSettings: AnyPromptFolderSettings =
      kind === 'template'
        ? { folderDescription }
        : {
            folderDescription,
            folderPrefix: readOptionalTextFile(
              resolvePromptFolderSettingsTextPath(
                workspacePath,
                folderPath,
                'folderPrefix',
                kind
              )
            ),
            folderSuffix: readOptionalTextFile(
              resolvePromptFolderSettingsTextPath(
                workspacePath,
                folderPath,
                'folderSuffix',
                kind
              )
            )
          }

    return fromPromptFolderInfoFile(
      persistedInfo,
      folderName,
      entries,
      completedPromptIds,
      copyPromptFolderSettings(folderSettings)
    )
  }
}
