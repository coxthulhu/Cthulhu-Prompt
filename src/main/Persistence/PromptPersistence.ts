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

type PromptFilePaths = {
  stem: string
  markdownPath: string
  metadataPath: string
}

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

const listPromptMetadataStems = (folderPath: string): Set<string> => {
  const fs = getFs()
  const stems = new Set<string>()

  if (!fs.existsSync(folderPath)) {
    return stems
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(PROMPT_METADATA_SUFFIX)) {
      continue
    }

    stems.add(entry.name.slice(0, -PROMPT_METADATA_SUFFIX.length))
  }

  return stems
}

const findPromptFilesById = (folderPath: string, promptId: string): PromptFilePaths | null => {
  const fs = getFs()
  if (!fs.existsSync(folderPath)) {
    return null
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(PROMPT_METADATA_SUFFIX)) {
      continue
    }

    const metadataPath = path.join(folderPath, entry.name)
    const metadata = readJsonFile<PromptMetadataFile>(metadataPath)

    if (metadata.id !== promptId) {
      continue
    }

    const stem = entry.name.slice(0, -PROMPT_METADATA_SUFFIX.length)
    return {
      stem,
      metadataPath,
      markdownPath: path.join(folderPath, `${stem}${PROMPT_MARKDOWN_SUFFIX}`)
    }
  }

  return null
}

const resolvePromptStem = (
  title: string,
  promptId: string,
  usedStems: Set<string>
): string => {
  const idPrefix = promptId.slice(0, 8)
  const titlePrefix = sanitizePromptTitleForFilename(title)
  const baseStem = `${titlePrefix}-${idPrefix}`

  if (!usedStems.has(baseStem)) {
    return baseStem
  }

  let suffix = 2
  while (usedStems.has(`${baseStem}-${suffix}`)) {
    suffix += 1
  }

  return `${baseStem}-${suffix}`
}

const resolvePromptPathsFromStem = (folderPath: string, stem: string): PromptFilePaths => {
  return {
    stem,
    markdownPath: path.join(folderPath, `${stem}${PROMPT_MARKDOWN_SUFFIX}`),
    metadataPath: path.join(folderPath, `${stem}${PROMPT_METADATA_SUFFIX}`)
  }
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
    const promptId = change.type === 'upsert' ? change.data.id : change.persistenceFields.promptId
    const existingPaths = findPromptFilesById(folderPath, promptId)

    if (change.type === 'remove') {
      if (!existingPaths) {
        return { fileChanges: [] }
      }

      return {
        fileChanges: [
          { type: 'remove', targetPath: existingPaths.metadataPath },
          { type: 'remove', targetPath: existingPaths.markdownPath }
        ]
      }
    }

    const usedStems = listPromptMetadataStems(folderPath)
    if (existingPaths) {
      usedStems.delete(existingPaths.stem)
    }

    const stem = resolvePromptStem(change.data.title, change.data.id, usedStems)
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
    if (existingPaths && existingPaths.metadataPath !== targetPaths.metadataPath) {
      fileChanges.push({ type: 'remove', targetPath: existingPaths.metadataPath })
    }
    if (existingPaths && existingPaths.markdownPath !== targetPaths.markdownPath) {
      fileChanges.push({ type: 'remove', targetPath: existingPaths.markdownPath })
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
      fileChanges
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
    const filePaths = findPromptFilesById(folderPath, persistenceFields.promptId)

    if (!filePaths) {
      return null
    }

    const metadata = readJsonFile<PromptMetadataFile>(filePaths.metadataPath)
    const fs = getFs()
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
