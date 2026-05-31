import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  type PromptFolder,
  type PromptFolderSettingsUpdate
} from '@shared/PromptFolder'
import type { PromptFolderInfoFile, PromptFolderOrderFile } from '../DiskTypes/WorkspaceDiskTypes'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedEnsureDirectory,
  createStagedFileRemove,
  createStagedFileUpsert,
  readJsonFile,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'
import {
  resolvePromptFolderInfoDirectoryPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderOrderPath,
  resolvePromptFolderPath,
  resolvePromptFolderSettingsTextPath
} from './PromptPersistencePaths'
import { getFs } from '../fs-provider'

export type PromptFolderPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
}

const toPromptFolderInfoFile = (promptFolder: PromptFolder): PromptFolderInfoFile => {
  return {
    displayName: promptFolder.displayName,
    promptFolderId: promptFolder.id
  }
}

const toPromptFolderOrderFile = (promptIds: string[]): PromptFolderOrderFile => {
  return { promptIds }
}

const fromPromptFolderInfoFile = (
  persistedInfo: PromptFolderInfoFile,
  folderName: string,
  promptIds: string[],
  folderSettings: PromptFolderSettingsUpdate
): PromptFolder => {
  return {
    id: persistedInfo.promptFolderId,
    folderName,
    displayName: persistedInfo.displayName,
    promptCount: promptIds.length,
    promptIds,
    ...folderSettings
  }
}

const readOptionalTextFile = (filePath: string): string => {
  const fs = getFs()
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

export const promptFolderPersistence: PersistenceLayer<
  PromptFolder,
  PromptFolderPersistenceFields
> = {
  stageChanges: async (change) => {
    const { workspacePath, folderName } = change.persistenceFields
    const folderPath = resolvePromptFolderPath(workspacePath, folderName)
    const orderPath = resolvePromptFolderOrderPath(workspacePath, folderName)
    const infoDirectoryPath = resolvePromptFolderInfoDirectoryPath(workspacePath, folderName)
    const infoPath = resolvePromptFolderInfoPath(workspacePath, folderName)
    const settingsTextPaths = PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => ({
      field,
      path: resolvePromptFolderSettingsTextPath(workspacePath, folderName, field)
    }))

    if (change.type === 'remove') {
      return createPersistenceStageResult([
        createStagedFileRemove(orderPath),
        createStagedFileRemove(infoPath),
        ...settingsTextPaths.map(({ path }) => createStagedFileRemove(path))
      ])
    }

    const fs = getFs()
    const folderAlreadyExists = fs.existsSync(folderPath)
    const infoDirectoryAlreadyExists = fs.existsSync(infoDirectoryPath)
    // Side effect: create prompt folder metadata directories before staging writes.
    fs.mkdirSync(folderPath, { recursive: true })
    fs.mkdirSync(infoDirectoryPath, { recursive: true })

    const orderTempPath = resolveTempPath(orderPath)
    writeJsonFile(orderTempPath, toPromptFolderOrderFile(change.data.promptIds))
    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, toPromptFolderInfoFile(change.data))
    const settingsTextTempPaths = settingsTextPaths.map(({ field, path }) => {
      const tempPath = resolveTempPath(path)
      fs.writeFileSync(tempPath, change.data[field], 'utf8')
      return { path, tempPath }
    })

    return createPersistenceStageResult([
      createStagedFileUpsert(orderPath, orderTempPath),
      createStagedFileUpsert(infoPath, infoTempPath),
      ...settingsTextTempPaths.map(({ path, tempPath }) => createStagedFileUpsert(path, tempPath)),
      createStagedEnsureDirectory(folderPath, !folderAlreadyExists),
      createStagedEnsureDirectory(infoDirectoryPath, !infoDirectoryAlreadyExists)
    ])
  },
  commitChanges: async (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (persistenceFields) => {
    const { workspacePath, folderName } = persistenceFields
    const orderPath = resolvePromptFolderOrderPath(workspacePath, folderName)
    const infoPath = resolvePromptFolderInfoPath(workspacePath, folderName)
    const fs = getFs()

    if (!fs.existsSync(orderPath) || !fs.existsSync(infoPath)) {
      return null
    }

    const persistedInfo = readJsonFile<PromptFolderInfoFile>(infoPath)
    const promptIds = [...readJsonFile<PromptFolderOrderFile>(orderPath).promptIds]
    const folderSettings = Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        readOptionalTextFile(resolvePromptFolderSettingsTextPath(workspacePath, folderName, field))
      ])
    ) as PromptFolderSettingsUpdate

    return fromPromptFolderInfoFile(persistedInfo, folderName, promptIds, folderSettings)
  }
}
