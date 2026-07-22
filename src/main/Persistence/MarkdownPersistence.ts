import type { PromptFolderKind } from '@shared/PromptFolder'
import { buildPromptStem } from '@shared/promptFilename'
import {
  commitStagedFileChanges,
  createStagedEnsureDirectory,
  createStagedFileRemove,
  createStagedFileUpsert,
  type FilePersistenceStagedChange,
  revertStagedFileChanges,
  resolveTempPath
} from './FilePersistenceHelpers'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import { resolvePromptFolderPath, resolvePromptPathsFromStem } from './PromptPersistencePaths'
import { getFs } from '../fs-provider'

export type MarkdownPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderPath: string
  previousFolderPath?: string
  promptFolderId: string
  promptId: string
  promptStem: string
  needsFilenameIdSuffix: boolean
}

type MarkdownData = {
  id: string
  modifiedAt: string
}

type MarkdownPersistenceOptions<TData extends MarkdownData> = {
  kind: PromptFolderKind
  getDisplayTitle: (data: TData) => string
  parseMarkdown: (fileText: string) => TData | null
  serializeMarkdown: (data: TData) => string
  normalizeLoadedData?: (data: TData, folderPath: string) => TData
  shouldRewriteNormalizedData?: (loaded: TData, normalized: TData) => boolean
}

export const readMarkdownModifiedAt = (
  persistenceFields: MarkdownPersistenceFields,
  kind: PromptFolderKind
): string => {
  const folderPath = resolvePromptFolderPath(
    persistenceFields.workspacePath,
    persistenceFields.folderPath,
    kind
  )
  const filePaths = resolvePromptPathsFromStem(folderPath, persistenceFields.promptStem, kind)
  return getFs().statSync(filePaths.markdownPath).mtime.toISOString()
}

export const createMarkdownPersistence = <TData extends MarkdownData>({
  kind,
  getDisplayTitle,
  parseMarkdown,
  serializeMarkdown,
  normalizeLoadedData = (data) => data,
  shouldRewriteNormalizedData = () => false
}: MarkdownPersistenceOptions<TData>): PersistenceLayer<TData, MarkdownPersistenceFields> => ({
  stageChanges: async (change) => {
    const currentFolderPath = resolvePromptFolderPath(
      change.persistenceFields.workspacePath,
      change.persistenceFields.previousFolderPath ?? change.persistenceFields.folderPath,
      kind
    )
    const targetFolderPath = resolvePromptFolderPath(
      change.persistenceFields.workspacePath,
      change.persistenceFields.folderPath,
      kind
    )
    const currentPaths = resolvePromptPathsFromStem(
      currentFolderPath,
      change.persistenceFields.promptStem,
      kind
    )

    if (change.type === 'remove') {
      return createPersistenceStageResult([createStagedFileRemove(currentPaths.markdownPath)])
    }

    const stem = buildPromptStem(
      getDisplayTitle(change.data),
      change.data.id,
      change.persistenceFields.needsFilenameIdSuffix
    )
    const targetPaths = resolvePromptPathsFromStem(targetFolderPath, stem, kind)
    const markdownTempPath = resolveTempPath(targetPaths.markdownPath)
    const fs = getFs()
    const targetFolderAlreadyExists = fs.existsSync(targetFolderPath)
    // Side effect: create the target content directory before staging its temp file.
    fs.mkdirSync(targetFolderPath, { recursive: true })
    fs.writeFileSync(markdownTempPath, serializeMarkdown(change.data), 'utf8')

    const fileChanges: FilePersistenceStagedChange[] = []
    if (currentPaths.markdownPath !== targetPaths.markdownPath) {
      fileChanges.push(createStagedFileRemove(currentPaths.markdownPath))
    }

    fileChanges.push(createStagedFileUpsert(targetPaths.markdownPath, markdownTempPath))
    fileChanges.push(createStagedEnsureDirectory(targetFolderPath, !targetFolderAlreadyExists))

    const { previousFolderPath: _previousFolderPath, ...nextPersistenceFields } =
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
      persistenceFields.folderPath,
      kind
    )
    const filePaths = resolvePromptPathsFromStem(folderPath, persistenceFields.promptStem, kind)
    const fs = getFs()
    if (!fs.existsSync(filePaths.markdownPath)) return null

    const loadedData = parseMarkdown(fs.readFileSync(filePaths.markdownPath, 'utf8'))
    if (!loadedData) return null

    const normalizedData = normalizeLoadedData(loadedData, persistenceFields.folderPath)
    if (shouldRewriteNormalizedData(loadedData, normalizedData)) {
      fs.writeFileSync(filePaths.markdownPath, serializeMarkdown(normalizedData), 'utf8')
    }

    return {
      ...normalizedData,
      modifiedAt: readMarkdownModifiedAt(persistenceFields, kind)
    }
  }
})
