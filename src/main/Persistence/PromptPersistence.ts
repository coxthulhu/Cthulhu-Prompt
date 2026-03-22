import type { PromptPersisted } from '@shared/Prompt'
import { resolveUniquePromptStem } from '@shared/promptFilename'
import type { PromptMetadataFile } from '../DiskTypes/WorkspaceDiskTypes'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedFileRemove,
  createStagedFileUpsert,
  type FilePersistenceStagedChange,
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
  return resolveUniquePromptStem(title, promptId, (stem) => {
    return isStemTaken(folderPath, stem, currentStem)
  })
}

const resolvePromptStemTitle = (title: string, promptFolderCount: number): string => {
  const trimmedTitle = title.trim()
  return trimmedTitle.length > 0 ? title : `Prompt ${promptFolderCount}`
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
      return createPersistenceStageResult([
        createStagedFileRemove(currentPaths.metadataPath),
        createStagedFileRemove(currentPaths.markdownPath)
      ])
    }

    const stemTitle = resolvePromptStemTitle(change.data.title, change.data.promptFolderCount)
    const stem = resolvePromptStem(stemTitle, change.data.id, folderPath, currentStem)
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
      fileChanges.push(createStagedFileRemove(currentPaths.metadataPath))
    }
    if (currentPaths.markdownPath !== targetPaths.markdownPath) {
      fileChanges.push(createStagedFileRemove(currentPaths.markdownPath))
    }

    fileChanges.push(createStagedFileUpsert(targetPaths.metadataPath, metadataTempPath))
    fileChanges.push(createStagedFileUpsert(targetPaths.markdownPath, markdownTempPath))

    return createPersistenceStageResult(fileChanges, {
      ...change.persistenceFields,
      promptStem: stem
    })
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
