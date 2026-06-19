import * as path from 'path'
import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  copyPromptFolderSettings,
  type PromptFolder,
  type PromptFolderSettings
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
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  resolvePromptFolderInfoDirectoryPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderOrderPath,
  resolvePromptFolderPath,
  resolveCompletedPromptFolderName,
  resolvePromptFolderSettingsTextPath
} from './PromptPersistencePaths'
import { parsePromptMarkdown } from './PromptFrontmatter'
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
  completedPromptIds: string[],
  settings: PromptFolderSettings
): PromptFolder => {
  return {
    id: persistedInfo.promptFolderId,
    folderName,
    displayName: persistedInfo.displayName,
    promptCount: promptIds.length,
    promptIds,
    completedPromptIds,
    settings
  }
}

const readOptionalTextFile = (filePath: string): string => {
  const fs = getFs()
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

const readCompletedPromptIds = (workspacePath: string, folderName: string): string[] => {
  const fs = getFs()
  const completedFolderPath = resolvePromptFolderPath(
    workspacePath,
    resolveCompletedPromptFolderName(folderName)
  )

  if (!fs.existsSync(completedFolderPath)) {
    return []
  }

  return fs
    .readdirSync(completedFolderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(PROMPT_MARKDOWN_FILENAME_SUFFIX))
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const prompt = parsePromptMarkdown(
        fs.readFileSync(path.join(completedFolderPath, entry.name), 'utf8')
      )
      return prompt ? [prompt.id] : []
    })
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
      fs.writeFileSync(tempPath, change.data.settings[field], 'utf8')
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
    const completedPromptIds = readCompletedPromptIds(workspacePath, folderName)
    const folderSettings = Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        readOptionalTextFile(resolvePromptFolderSettingsTextPath(workspacePath, folderName, field))
      ])
    ) as PromptFolderSettings

    return fromPromptFolderInfoFile(
      persistedInfo,
      folderName,
      promptIds,
      completedPromptIds,
      copyPromptFolderSettings(folderSettings)
    )
  }
}
