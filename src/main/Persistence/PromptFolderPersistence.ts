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
  folderPath: string
  previousFolderPath?: string
  parentPromptFolderId: string | null
  depth: number
}

const toPromptFolderInfoFile = (promptFolder: PromptFolder): PromptFolderInfoFile => {
  return {
    displayName: promptFolder.displayName,
    promptFolderId: promptFolder.id
  }
}

const toPromptFolderOrderFile = (entryIds: string[]): PromptFolderOrderFile => {
  return { entryIds }
}

const fromPromptFolderInfoFile = (
  persistedInfo: PromptFolderInfoFile,
  folderName: string,
  parentPromptFolderId: string | null,
  depth: number,
  modifiedAt: string | null,
  entryIds: string[],
  promptCount: number,
  completedPromptIds: string[],
  settings: PromptFolderSettings
): PromptFolder => {
  return {
    id: persistedInfo.promptFolderId,
    folderName,
    displayName: persistedInfo.displayName,
    parentPromptFolderId,
    depth,
    modifiedAt,
    promptCount,
    entryIds,
    completedPromptIds,
    settings
  }
}

const readOptionalTextFile = (filePath: string): string => {
  const fs = getFs()
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

const readPromptModifiedAtByPromptId = (
  workspacePath: string,
  folderName: string
): Map<string, string> => {
  const fs = getFs()
  const folderPath = resolvePromptFolderPath(workspacePath, folderName)
  const modifiedAtByPromptId = new Map<string, string>()

  if (!fs.existsSync(folderPath)) {
    return modifiedAtByPromptId
  }

  for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(PROMPT_MARKDOWN_FILENAME_SUFFIX)) {
      continue
    }

    const filePath = path.join(folderPath, entry.name)
    const prompt = parsePromptMarkdown(fs.readFileSync(filePath, 'utf8'))
    if (!prompt) {
      continue
    }

    modifiedAtByPromptId.set(prompt.id, fs.statSync(filePath).mtime.toISOString())
  }

  return modifiedAtByPromptId
}

const readPromptFolderModifiedAt = (
  workspacePath: string,
  folderName: string,
  promptIds: string[]
): string | null => {
  const modifiedAtByPromptId = readPromptModifiedAtByPromptId(workspacePath, folderName)
  let latestModifiedAtMs: number | null = null

  for (const promptId of promptIds) {
    const modifiedAt = modifiedAtByPromptId.get(promptId)
    if (!modifiedAt) {
      continue
    }

    const modifiedAtMs = new Date(modifiedAt).getTime()
    latestModifiedAtMs =
      latestModifiedAtMs === null ? modifiedAtMs : Math.max(latestModifiedAtMs, modifiedAtMs)
  }

  return latestModifiedAtMs === null ? null : new Date(latestModifiedAtMs).toISOString()
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
    const { workspacePath, folderPath: targetRelativePath } = change.persistenceFields
    const previousFolderPath = change.persistenceFields.previousFolderPath
    const stagingRelativePath = previousFolderPath ?? targetRelativePath
    const folderPath = resolvePromptFolderPath(workspacePath, stagingRelativePath)
    const orderPath = resolvePromptFolderOrderPath(workspacePath, stagingRelativePath)
    const infoDirectoryPath = resolvePromptFolderInfoDirectoryPath(
      workspacePath,
      stagingRelativePath
    )
    const infoPath = resolvePromptFolderInfoPath(workspacePath, stagingRelativePath)
    const settingsTextPaths = PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => ({
      field,
      path: resolvePromptFolderSettingsTextPath(workspacePath, stagingRelativePath, field)
    }))
    const isFolderRename =
      previousFolderPath !== undefined && previousFolderPath !== targetRelativePath
    const targetFolderPath = resolvePromptFolderPath(workspacePath, targetRelativePath)

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
    writeJsonFile(orderTempPath, toPromptFolderOrderFile(change.data.entryIds))
    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, toPromptFolderInfoFile(change.data))
    const settingsTextTempPaths = settingsTextPaths.map(({ field, path }) => {
      const tempPath = resolveTempPath(path)
      fs.writeFileSync(tempPath, change.data.settings[field], 'utf8')
      return { path, tempPath }
    })

    const stagedChanges = [
      createStagedFileUpsert(orderPath, orderTempPath),
      createStagedFileUpsert(infoPath, infoTempPath),
      ...settingsTextTempPaths.map(({ path, tempPath }) => createStagedFileUpsert(path, tempPath)),
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
    const { workspacePath, folderName, folderPath, parentPromptFolderId, depth } =
      persistenceFields
    const orderPath = resolvePromptFolderOrderPath(workspacePath, folderPath)
    const infoPath = resolvePromptFolderInfoPath(workspacePath, folderPath)
    const fs = getFs()

    if (!fs.existsSync(orderPath) || !fs.existsSync(infoPath)) {
      return null
    }

    const persistedInfo = readJsonFile<PromptFolderInfoFile>(infoPath)
    const entryIds = [...readJsonFile<PromptFolderOrderFile>(orderPath).entryIds]
    const modifiedAtByPromptId = readPromptModifiedAtByPromptId(workspacePath, folderPath)
    const promptIds = entryIds.filter((entryId) => modifiedAtByPromptId.has(entryId))
    const completedPromptIds = readCompletedPromptIds(workspacePath, folderPath)
    const modifiedAt = readPromptFolderModifiedAt(workspacePath, folderPath, promptIds)
    const folderSettings = Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        readOptionalTextFile(resolvePromptFolderSettingsTextPath(workspacePath, folderPath, field))
      ])
    ) as PromptFolderSettings

    return fromPromptFolderInfoFile(
      persistedInfo,
      folderName,
      parentPromptFolderId,
      depth,
      modifiedAt,
      entryIds,
      promptIds.length,
      completedPromptIds,
      copyPromptFolderSettings(folderSettings)
    )
  }
}
