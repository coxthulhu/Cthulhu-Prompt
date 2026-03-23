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
import {
  resolvePromptFolderConfigPath,
  resolvePromptFolderDescriptionPath,
  resolvePromptFolderPath
} from './PromptPersistencePaths'
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
    promptIds: promptFolder.promptIds
  }
}

const fromPromptFolderConfigFile = (
  persistedConfig: PromptFolderConfigFile,
  folderName: string,
  folderDescription: string
): PromptFolder => {
  return {
    id: persistedConfig.promptFolderId,
    folderName,
    displayName: persistedConfig.foldername,
    promptCount: persistedConfig.promptCount,
    promptIds: persistedConfig.promptIds,
    folderDescription
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
    const descriptionPath = resolvePromptFolderDescriptionPath(workspacePath, folderName)

    if (change.type === 'remove') {
      return createPersistenceStageResult([
        createStagedFileRemove(configPath),
        createStagedFileRemove(descriptionPath)
      ])
    }

    const fs = getFs()
    const folderAlreadyExists = fs.existsSync(folderPath)
    // Side effect: create prompt folder directory before staging config writes.
    fs.mkdirSync(folderPath, { recursive: true })

    const configTempPath = resolveTempPath(configPath)
    const persistedConfig = toPromptFolderConfigFile(change.data)
    writeJsonFile(configTempPath, persistedConfig)
    const descriptionTempPath = resolveTempPath(descriptionPath)
    fs.writeFileSync(descriptionTempPath, change.data.folderDescription, 'utf8')

    return createPersistenceStageResult([
      createStagedFileUpsert(configPath, configTempPath),
      createStagedFileUpsert(descriptionPath, descriptionTempPath),
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
    const descriptionPath = resolvePromptFolderDescriptionPath(workspacePath, folderName)
    const fs = getFs()

    if (!fs.existsSync(configPath)) {
      return null
    }

    const persistedConfig = readJsonFile<PromptFolderConfigFile>(configPath)
    const folderDescription = fs.existsSync(descriptionPath)
      ? fs.readFileSync(descriptionPath, 'utf8')
      : ''

    return fromPromptFolderConfigFile(persistedConfig, folderName, folderDescription)
  }
}
