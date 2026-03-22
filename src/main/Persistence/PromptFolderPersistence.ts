import type { PromptFolder } from '@shared/PromptFolder'
import type { PromptFolderConfigFile } from '../DiskTypes/WorkspaceDiskTypes'
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
import { resolvePromptFolderConfigPath, resolvePromptFolderPath } from './PromptPersistencePaths'
import { getFs } from '../fs-provider'

export type PromptFolderPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
}

const toPromptFolderConfigFile = (promptFolder: PromptFolder): PromptFolderConfigFile => {
  return {
    foldername: promptFolder.displayName,
    promptFolderId: promptFolder.id,
    promptCount: promptFolder.promptCount,
    folderDescription: promptFolder.folderDescription,
    promptIds: promptFolder.promptIds
  }
}

const fromPromptFolderConfigFile = (
  persistedConfig: PromptFolderConfigFile,
  folderName: string
): PromptFolder => {
  return {
    id: persistedConfig.promptFolderId,
    folderName,
    displayName: persistedConfig.foldername,
    promptCount: persistedConfig.promptCount,
    promptIds: persistedConfig.promptIds,
    folderDescription: persistedConfig.folderDescription
  }
}

export const promptFolderPersistence: PersistenceLayer<
  PromptFolder,
  PromptFolderPersistenceFields
> = {
  stageChanges: async (change) => {
    const { workspacePath, folderName } = change.persistenceFields
    const folderPath = resolvePromptFolderPath(workspacePath, folderName)
    const configPath = resolvePromptFolderConfigPath(workspacePath, folderName)

    if (change.type === 'remove') {
      return createPersistenceStageResult([createStagedFileRemove(configPath)])
    }

    const fs = getFs()
    const folderAlreadyExists = fs.existsSync(folderPath)
    // Side effect: create prompt folder directory before staging config writes.
    fs.mkdirSync(folderPath, { recursive: true })

    const configTempPath = resolveTempPath(configPath)
    const persistedConfig = toPromptFolderConfigFile(change.data)
    writeJsonFile(configTempPath, persistedConfig)

    return createPersistenceStageResult([
      createStagedFileUpsert(configPath, configTempPath),
      createStagedEnsureDirectory(folderPath, !folderAlreadyExists)
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
    const configPath = resolvePromptFolderConfigPath(workspacePath, folderName)
    const fs = getFs()

    if (!fs.existsSync(configPath)) {
      return null
    }

    const persistedConfig = readJsonFile<PromptFolderConfigFile>(configPath)

    return fromPromptFolderConfigFile(persistedConfig, folderName)
  }
}
