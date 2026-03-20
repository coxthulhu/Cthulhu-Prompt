import type { PromptPersisted } from '@shared/Prompt'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedFileChangeBatch,
  createStagedFileRemove,
  createStagedFileUpsert,
  type FilePersistenceStagedChangeBatch,
  readJsonFile,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'
import { resolvePromptFolderPath, resolvePromptPathsFromStem } from './PromptPersistencePaths'
import { getFs } from '../fs-provider'

export type PromptPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptFolderId: string
  promptId: string
  promptStem: string
}

type PromptMetadataFile = {
  id: string
  title: string
  creationDate: string
  lastModifiedDate: string
  promptFolderCount: number
}

const MAX_PROMPT_FILENAME_TITLE_LENGTH = 64
const DEFAULT_PROMPT_FILENAME_TITLE = 'Prompt'
// eslint-disable-next-line no-control-regex
const ILLEGAL_WINDOWS_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g

const sanitizePromptTitleForFilename = (title: string): string => {
  const noIllegalChars = title.trim().replace(ILLEGAL_WINDOWS_FILENAME_CHARS, '')
  const noTrailingDotsOrSpaces = noIllegalChars.replace(/[. ]+$/g, '').trim()
  const normalizedTitle = noTrailingDotsOrSpaces || DEFAULT_PROMPT_FILENAME_TITLE
  return normalizedTitle.slice(0, MAX_PROMPT_FILENAME_TITLE_LENGTH)
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
  PromptPersistenceFields,
  FilePersistenceStagedChangeBatch
> = {
  stageChanges: async (change) => {
    const folderPath = resolvePromptFolderPath(
      change.persistenceFields.workspacePath,
      change.persistenceFields.folderName
    )
    const currentStem = change.persistenceFields.promptStem
    const currentPaths = resolvePromptPathsFromStem(folderPath, currentStem)

    if (change.type === 'remove') {
      return createPersistenceStageResult(
        createStagedFileChangeBatch(
          createStagedFileRemove(currentPaths.metadataPath),
          createStagedFileRemove(currentPaths.markdownPath)
        )
      )
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

    const fileChanges: FilePersistenceStagedChangeBatch['fileChanges'] = []

    // Side effect: remove stale title-based files when title changes.
    if (currentPaths.metadataPath !== targetPaths.metadataPath) {
      fileChanges.push(createStagedFileRemove(currentPaths.metadataPath))
    }
    if (currentPaths.markdownPath !== targetPaths.markdownPath) {
      fileChanges.push(createStagedFileRemove(currentPaths.markdownPath))
    }

    fileChanges.push(createStagedFileUpsert(targetPaths.metadataPath, metadataTempPath))
    fileChanges.push(createStagedFileUpsert(targetPaths.markdownPath, markdownTempPath))

    return createPersistenceStageResult(
      createStagedFileChangeBatch(...fileChanges),
      {
        ...change.persistenceFields,
        promptStem: stem
      }
    )
  },
  commitChanges: async (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChanges(stagedChange)
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
