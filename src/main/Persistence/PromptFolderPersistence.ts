import type { PromptFolder } from '@shared/PromptFolder'
import type {
  PromptFolderInfoFile,
  PromptFolderOrderFile
} from '../DiskTypes/WorkspaceDiskTypes'
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
  resolvePromptFolderDescriptionPath,
  resolvePromptFolderInfoDirectoryPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderOrderPath,
  resolvePromptFolderPath
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
    promptFolderId: promptFolder.id,
    promptCount: promptFolder.promptCount
  }
}

const toPromptFolderOrderFile = (promptIds: string[]): PromptFolderOrderFile => {
  return { promptIds }
}

const fromPromptFolderInfoFile = (
  persistedInfo: PromptFolderInfoFile,
  folderName: string,
  promptIds: string[],
  folderDescription: string
): PromptFolder => {
  return {
    id: persistedInfo.promptFolderId,
    folderName,
    displayName: persistedInfo.displayName,
    promptCount: persistedInfo.promptCount,
    promptIds,
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
    const orderPath = resolvePromptFolderOrderPath(workspacePath, folderName)
    const infoDirectoryPath = resolvePromptFolderInfoDirectoryPath(workspacePath, folderName)
    const infoPath = resolvePromptFolderInfoPath(workspacePath, folderName)
    const descriptionPath = resolvePromptFolderDescriptionPath(workspacePath, folderName)

    if (change.type === 'remove') {
      return createPersistenceStageResult([
        createStagedFileRemove(orderPath),
        createStagedFileRemove(infoPath),
        createStagedFileRemove(descriptionPath)
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
    const descriptionTempPath = resolveTempPath(descriptionPath)
    fs.writeFileSync(descriptionTempPath, change.data.folderDescription, 'utf8')

    return createPersistenceStageResult([
      createStagedFileUpsert(orderPath, orderTempPath),
      createStagedFileUpsert(infoPath, infoTempPath),
      createStagedFileUpsert(descriptionPath, descriptionTempPath),
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
    const descriptionPath = resolvePromptFolderDescriptionPath(workspacePath, folderName)
    const fs = getFs()

    if (!fs.existsSync(orderPath) || !fs.existsSync(infoPath)) {
      return null
    }

    const persistedInfo = readJsonFile<PromptFolderInfoFile>(infoPath)
    const promptIds = [...readJsonFile<PromptFolderOrderFile>(orderPath).promptIds]
    const folderDescription = fs.existsSync(descriptionPath)
      ? fs.readFileSync(descriptionPath, 'utf8')
      : ''

    return fromPromptFolderInfoFile(persistedInfo, folderName, promptIds, folderDescription)
  }
}
