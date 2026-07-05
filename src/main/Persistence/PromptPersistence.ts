import { PromptStatus, type PromptPersisted } from '@shared/Prompt'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
import { buildPromptStem } from '@shared/promptFilename'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedEnsureDirectory,
  createStagedFileRemove,
  createStagedFileUpsert,
  type FilePersistenceStagedChange,
  revertStagedFileChanges,
  resolveTempPath
} from './FilePersistenceHelpers'
import { parsePromptMarkdown, serializePromptMarkdown } from './PromptFrontmatter'
import {
  COMPLETED_PROMPTS_FOLDER_NAME,
  resolvePromptFolderPath,
  resolvePromptPathsFromStem
} from './PromptPersistencePaths'
import { getFs } from '../fs-provider'

export type PromptPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  previousFolderName?: string
  promptFolderId: string
  promptId: string
  promptStem: string
  needsFilenameIdSuffix: boolean
}

const isCompletedPromptFolderName = (folderName: string): boolean => {
  const folderNameParts = folderName.split(/[\\/]/)
  return folderNameParts[folderNameParts.length - 1] === COMPLETED_PROMPTS_FOLDER_NAME
}

const normalizePromptCompletionForFolder = (
  prompt: PromptPersisted,
  isCompletedFolder: boolean
): PromptPersisted => {
  if (isCompletedFolder) {
    if (prompt.status === PromptStatus.Completed && prompt.completedAt) {
      return prompt
    }

    return {
      ...prompt,
      status: PromptStatus.Completed,
      completedAt: getCurrentIsoSecondTimestamp()
    }
  }

  if (
    (prompt.status === PromptStatus.Todo || prompt.status === PromptStatus.InProgress) &&
    !prompt.completedAt
  ) {
    return prompt
  }

  const { completedAt: _completedAt, ...activePrompt } = prompt
  return {
    ...activePrompt,
    status: PromptStatus.Todo
  }
}

const hasSameCompletionMetadata = (left: PromptPersisted, right: PromptPersisted): boolean => {
  return left.status === right.status && left.completedAt === right.completedAt
}

export const readPromptModifiedAt = (persistenceFields: PromptPersistenceFields): string => {
  const folderPath = resolvePromptFolderPath(
    persistenceFields.workspacePath,
    persistenceFields.folderName
  )
  const filePaths = resolvePromptPathsFromStem(folderPath, persistenceFields.promptStem)
  const fs = getFs()
  return fs.statSync(filePaths.markdownPath).mtime.toISOString()
}

export const promptPersistence: PersistenceLayer<PromptPersisted, PromptPersistenceFields> = {
  stageChanges: async (change) => {
    const currentFolderPath = resolvePromptFolderPath(
      change.persistenceFields.workspacePath,
      change.persistenceFields.previousFolderName ?? change.persistenceFields.folderName
    )
    const targetFolderPath = resolvePromptFolderPath(
      change.persistenceFields.workspacePath,
      change.persistenceFields.folderName
    )
    const currentStem = change.persistenceFields.promptStem
    const currentPaths = resolvePromptPathsFromStem(currentFolderPath, currentStem)

    if (change.type === 'remove') {
      return createPersistenceStageResult([createStagedFileRemove(currentPaths.markdownPath)])
    }

    const stemTitle = getPromptDisplayTitle(change.data)
    const stem = buildPromptStem(
      stemTitle,
      change.data.id,
      change.persistenceFields.needsFilenameIdSuffix
    )
    const targetPaths = resolvePromptPathsFromStem(targetFolderPath, stem)
    const markdownTempPath = resolveTempPath(targetPaths.markdownPath)
    const fs = getFs()
    const targetFolderAlreadyExists = fs.existsSync(targetFolderPath)
    // Side effect: create the target prompt directory before staging its temp file.
    fs.mkdirSync(targetFolderPath, { recursive: true })
    fs.writeFileSync(markdownTempPath, serializePromptMarkdown(change.data), 'utf8')

    const fileChanges: FilePersistenceStagedChange[] = []

    // Side effect: remove stale title-based files when title changes.
    if (currentPaths.markdownPath !== targetPaths.markdownPath) {
      fileChanges.push(createStagedFileRemove(currentPaths.markdownPath))
    }

    fileChanges.push(createStagedFileUpsert(targetPaths.markdownPath, markdownTempPath))
    fileChanges.push(createStagedEnsureDirectory(targetFolderPath, !targetFolderAlreadyExists))

    const { previousFolderName: _previousFolderName, ...nextPersistenceFields } =
      change.persistenceFields

    return createPersistenceStageResult(fileChanges, {
      ...nextPersistenceFields,
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

    if (!fs.existsSync(filePaths.markdownPath)) {
      return null
    }

    const prompt = parsePromptMarkdown(fs.readFileSync(filePaths.markdownPath, 'utf8'))

    if (!prompt) {
      return null
    }

    const normalizedPrompt = normalizePromptCompletionForFolder(
      prompt,
      isCompletedPromptFolderName(persistenceFields.folderName)
    )

    if (!hasSameCompletionMetadata(prompt, normalizedPrompt)) {
      fs.writeFileSync(filePaths.markdownPath, serializePromptMarkdown(normalizedPrompt), 'utf8')
    }

    return {
      ...normalizedPrompt,
      modifiedAt: readPromptModifiedAt(persistenceFields)
    }
  }
}
