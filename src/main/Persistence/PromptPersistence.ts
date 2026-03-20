import type { PromptPersisted } from '@shared/Prompt'
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

export type PromptPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptFolderId: string
  promptId: string
  promptStem: string
}

type PromptPersistenceStagedChange = {
  fileChanges: FilePersistenceStagedChange[]
}

type PromptMetadataFile = {
  id: string
  title: string
  creationDate: string
  lastModifiedDate: string
  promptFolderCount: number
}

type PromptFilePaths = { markdownPath: string; metadataPath: string }

const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_METADATA_SUFFIX = '.prompt.json'
const PROMPT_MARKDOWN_SUFFIX = '.md'
const MAX_PROMPT_FILENAME_TITLE_LENGTH = 64
const DEFAULT_PROMPT_FILENAME_TITLE = 'Prompt'
// eslint-disable-next-line no-control-regex
const ILLEGAL_WINDOWS_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g

const resolvePromptFolderPath = (workspacePath: string, folderName: string): string => {
  return path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName)
}

const sanitizePromptTitleForFilename = (title: string): string => {
  const noIllegalChars = title.trim().replace(ILLEGAL_WINDOWS_FILENAME_CHARS, '')
  const noTrailingDotsOrSpaces = noIllegalChars.replace(/[. ]+$/g, '').trim()
  const normalizedTitle = noTrailingDotsOrSpaces || DEFAULT_PROMPT_FILENAME_TITLE
  return normalizedTitle.slice(0, MAX_PROMPT_FILENAME_TITLE_LENGTH)
}

const resolvePromptPathsFromStem = (folderPath: string, stem: string): PromptFilePaths => {
  return {
    markdownPath: path.join(folderPath, `${stem}${PROMPT_MARKDOWN_SUFFIX}`),
    metadataPath: path.join(folderPath, `${stem}${PROMPT_METADATA_SUFFIX}`)
  }
}

const isStemTaken = (folderPath: string, stem: string, currentStem: string): boolean => {
  if (stem === currentStem) {
    return false
  }

  const stemPaths = resolvePromptPathsFromStem(folderPath, stem)
  const fs = getFs()
  return fs.existsSync(stemPaths.metadataPath) || fs.existsSync(stemPaths.markdownPath)
}

const resolvePromptStem = (
  title: string,
  promptId: string,
  folderPath: string,
  currentStem: string
): string => {
  const idPrefix = promptId.slice(0, 8)
  const titlePrefix = sanitizePromptTitleForFilename(title)
  const baseStem = `${titlePrefix}-${idPrefix}`

  if (!isStemTaken(folderPath, baseStem, currentStem)) {
    return baseStem
  }

  let suffix = 2
  while (isStemTaken(folderPath, `${baseStem}-${suffix}`, currentStem)) {
    suffix += 1
  }

  return `${baseStem}-${suffix}`
}

export const promptPersistence: PersistenceLayer<
  PromptPersisted,
  PromptPersistenceFields
> = {
  stageChanges: async (change) => {
    const folderPath = resolvePromptFolderPath(
      change.persistenceFields.workspacePath,
      change.persistenceFields.folderName
    )
    const currentStem = change.persistenceFields.promptStem
    const currentPaths = resolvePromptPathsFromStem(folderPath, currentStem)

    if (change.type === 'remove') {
      return {
        fileChanges: [
          { type: 'remove', targetPath: currentPaths.metadataPath },
          { type: 'remove', targetPath: currentPaths.markdownPath }
        ]
      }
    }

    const stem = resolvePromptStem(change.data.title, change.data.id, folderPath, currentStem)
    const targetPaths = resolvePromptPathsFromStem(folderPath, stem)
    const metadataTempPath = resolveTempPath(targetPaths.metadataPath)
    const markdownTempPath = resolveTempPath(targetPaths.markdownPath)

    writeJsonFile(metadataTempPath, {
      id: change.data.id,
      title: change.data.title,
      creationDate: change.data.creationDate,
      lastModifiedDate: change.data.lastModifiedDate,
      promptFolderCount: change.data.promptFolderCount
    })
    const fs = getFs()
    fs.writeFileSync(markdownTempPath, change.data.promptText, 'utf8')

    const fileChanges: FilePersistenceStagedChange[] = []

    // Side effect: remove stale title-based files when title changes.
    if (currentPaths.metadataPath !== targetPaths.metadataPath) {
      fileChanges.push({ type: 'remove', targetPath: currentPaths.metadataPath })
    }
    if (currentPaths.markdownPath !== targetPaths.markdownPath) {
      fileChanges.push({ type: 'remove', targetPath: currentPaths.markdownPath })
    }

    fileChanges.push({
      type: 'upsert',
      targetPath: targetPaths.metadataPath,
      tempPath: metadataTempPath
    })
    fileChanges.push({
      type: 'upsert',
      targetPath: targetPaths.markdownPath,
      tempPath: markdownTempPath
    })

    return {
      stagedChange: {
        fileChanges
      },
      nextPersistenceFields: {
        ...change.persistenceFields,
        promptStem: stem
      }
    }
  },
  commitChanges: async (stagedChange) => {
    for (const fileChange of (stagedChange as PromptPersistenceStagedChange).fileChanges) {
      commitStagedFileChange(fileChange)
    }
  },
  revertChanges: async (stagedChange) => {
    for (const fileChange of (stagedChange as PromptPersistenceStagedChange).fileChanges) {
      revertStagedFileChange(fileChange)
    }
  },
  loadData: async (persistenceFields) => {
    const folderPath = resolvePromptFolderPath(
      persistenceFields.workspacePath,
      persistenceFields.folderName
    )
    const filePaths = resolvePromptPathsFromStem(folderPath, persistenceFields.promptStem)
    const fs = getFs()

    if (!fs.existsSync(filePaths.metadataPath) || !fs.existsSync(filePaths.markdownPath)) {
      return null
    }

    const metadata = readJsonFile<PromptMetadataFile>(filePaths.metadataPath)
    if (metadata.id !== persistenceFields.promptId) {
      return null
    }
    const promptText = fs.readFileSync(filePaths.markdownPath, 'utf8')

    return {
      id: metadata.id,
      title: metadata.title,
      creationDate: metadata.creationDate,
      lastModifiedDate: metadata.lastModifiedDate,
      promptFolderCount: metadata.promptFolderCount,
      promptText
    }
  }
}
