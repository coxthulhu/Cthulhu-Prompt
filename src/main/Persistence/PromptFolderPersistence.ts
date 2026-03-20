import type { PromptFolder } from '@shared/PromptFolder'
import * as path from 'path'
import type { PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChange,
  readJsonFile,
  revertStagedFileChange,
  resolveTempPath,
  writeJsonFile,
  type FilePersistenceStagedChange
} from './FilePersistenceHelpers'
import { getFs } from '../fs-provider'

export type PromptFolderPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
}

type PromptFolderPersistenceStagedChange = {
  fileChanges: FilePersistenceStagedChange[]
}

const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'

const resolvePromptFolderPath = (workspacePath: string, folderName: string): string => {
  return path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName)
}

const resolvePromptFolderConfigPath = (workspacePath: string, folderName: string): string => {
  return path.join(resolvePromptFolderPath(workspacePath, folderName), PROMPT_FOLDER_CONFIG_FILENAME)
}

export const promptFolderPersistence: PersistenceLayer<
  PromptFolder,
  PromptFolderPersistenceFields
> = {
  stageChanges: async (change) => {
    const { workspacePath, folderName } = change.persistenceFields
    const configPath = resolvePromptFolderConfigPath(workspacePath, folderName)

    if (change.type === 'remove') {
      return {
        fileChanges: [{ type: 'remove', targetPath: configPath }]
      }
    }

    const configTempPath = resolveTempPath(configPath)

    writeJsonFile(configTempPath, {
      foldername: change.data.displayName,
      promptFolderId: change.data.id,
      promptCount: change.data.promptCount,
      folderDescription: change.data.folderDescription,
      promptIds: change.data.promptIds
    })

    return {
      fileChanges: [{ type: 'upsert', targetPath: configPath, tempPath: configTempPath }]
    }
  },
  commitChanges: async (stagedChange) => {
    for (const fileChange of (stagedChange as PromptFolderPersistenceStagedChange).fileChanges) {
      commitStagedFileChange(fileChange)
    }
  },
  revertChanges: async (stagedChange) => {
    for (const fileChange of (stagedChange as PromptFolderPersistenceStagedChange).fileChanges) {
      revertStagedFileChange(fileChange)
    }
  },
  loadData: async (persistenceFields) => {
    const { workspacePath, folderName } = persistenceFields
    const configPath = resolvePromptFolderConfigPath(workspacePath, folderName)
    const fs = getFs()

    if (!fs.existsSync(configPath)) {
      return null
    }

    const config = readJsonFile<{
      foldername: string
      promptFolderId: string
      promptCount: number
      folderDescription: string
      promptIds: string[]
    }>(configPath)

    return {
      id: config.promptFolderId,
      folderName,
      displayName: config.foldername,
      promptCount: config.promptCount,
      promptIds: config.promptIds,
      folderDescription: config.folderDescription
    }
  }
}
