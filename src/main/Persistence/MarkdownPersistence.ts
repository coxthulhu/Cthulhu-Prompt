import type { PromptCollectionContentKind } from '@shared/domain/prompt-collection/PromptCollection'
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
import { resolvePromptDirectoryPath, resolvePromptPathsFromStem } from './PromptPersistencePaths'
import { getFs } from '../fs-provider'

export type MarkdownPersistenceFields = {
  /** Library containing this Markdown file, independent of its extension. */
  collectionKind?: PromptCollectionContentKind
  workspaceId: string
  workspacePath: string
  folderPath: string
  promptCollectionId: string
  promptId: string
  promptStem: string
}

type MarkdownData = {
  id: string
  modifiedAt: string
}

type MarkdownPersistenceOptions<TData extends MarkdownData> = {
  kind: PromptCollectionContentKind | 'note'
  parseMarkdown: (fileText: string) => TData | null
  serializeMarkdown: (data: TData) => string
  normalizeLoadedData?: (data: TData, folderPath: string, fields: MarkdownPersistenceFields) => TData
  shouldRewriteNormalizedData?: (
    loaded: TData,
    normalized: TData,
    fileText: string
  ) => boolean
}

export const readMarkdownModifiedAt = (
  persistenceFields: MarkdownPersistenceFields,
  kind: PromptCollectionContentKind | 'note'
): string => {
  const folderPath = resolvePromptDirectoryPath(
    persistenceFields.workspacePath,
    persistenceFields.folderPath,
    persistenceFields.collectionKind ?? (kind === 'note' ? 'prompt' : kind)
  )
  const filePaths = resolvePromptPathsFromStem(folderPath, persistenceFields.promptStem, kind)
  return getFs().statSync(filePaths.markdownPath).mtime.toISOString()
}

export const createMarkdownPersistence = <TData extends MarkdownData>({
  kind,
  parseMarkdown,
  serializeMarkdown,
  normalizeLoadedData = (data) => data,
  shouldRewriteNormalizedData = () => false
}: MarkdownPersistenceOptions<TData>): PersistenceLayer<TData, MarkdownPersistenceFields> => ({
  kind: 'filesystem',
  stageChanges: async (transition) => {
    /** Current record whose resolved path is removed or replaced. */
    const before = transition.before
    /** Desired record whose data and resolved path are written. */
    const after = transition.after
    if (!before && !after) throw new Error('Markdown persistence transition is empty')
    /** Current markdown folder path when the entity already exists. */
    const currentFolderPath = before
      ? resolvePromptDirectoryPath(
          before.persistenceFields.workspacePath,
          before.persistenceFields.folderPath,
          before.persistenceFields.collectionKind ?? (kind === 'note' ? 'prompt' : kind)
        )
      : null
    /** Current markdown path when the entity already exists. */
    const currentMarkdownPath = before
      ? resolvePromptPathsFromStem(
          currentFolderPath!,
          before.persistenceFields.promptStem,
          kind
        ).markdownPath
      : null

    if (!after) {
      return createPersistenceStageResult([createStagedFileRemove(currentMarkdownPath!)])
    }

    /** Desired markdown persistence metadata. */
    const fields = after.persistenceFields
    const targetFolderPath = resolvePromptDirectoryPath(
      fields.workspacePath,
      fields.folderPath,
      fields.collectionKind ?? (kind === 'note' ? 'prompt' : kind)
    )
    /** Filename allocated once by the storage planner. */
    const stem = fields.promptStem
    const targetPaths = resolvePromptPathsFromStem(targetFolderPath, stem, kind)
    const markdownTempPath = resolveTempPath(targetPaths.markdownPath)
    const fs = getFs()
    const targetFolderAlreadyExists = fs.existsSync(targetFolderPath)
    // Side effect: create the target content directory before staging its temp file.
    fs.mkdirSync(targetFolderPath, { recursive: true })
    fs.writeFileSync(markdownTempPath, serializeMarkdown(after.data), 'utf8')

    const fileChanges: FilePersistenceStagedChange[] = []
    if (currentMarkdownPath && currentMarkdownPath !== targetPaths.markdownPath) {
      fileChanges.push(createStagedFileRemove(currentMarkdownPath))
    }

    fileChanges.push(createStagedFileUpsert(targetPaths.markdownPath, markdownTempPath))
    fileChanges.push(createStagedEnsureDirectory(targetFolderPath, !targetFolderAlreadyExists))

    return createPersistenceStageResult(fileChanges)
  },
  commitChanges: (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (persistenceFields) => {
    const folderPath = resolvePromptDirectoryPath(
      persistenceFields.workspacePath,
      persistenceFields.folderPath,
      persistenceFields.collectionKind ?? (kind === 'note' ? 'prompt' : kind)
    )
    const filePaths = resolvePromptPathsFromStem(folderPath, persistenceFields.promptStem, kind)
    const fs = getFs()
    if (!fs.existsSync(filePaths.markdownPath)) return null

    // Source text is retained so kind-specific normalization can request a rewrite.
    const fileText = fs.readFileSync(filePaths.markdownPath, 'utf8')
    const loadedData = parseMarkdown(fileText)
    if (!loadedData) return null

    const normalizedData = normalizeLoadedData(loadedData, persistenceFields.folderPath, persistenceFields)
    if (shouldRewriteNormalizedData(loadedData, normalizedData, fileText)) {
      fs.writeFileSync(filePaths.markdownPath, serializeMarkdown(normalizedData), 'utf8')
    }

    return {
      ...normalizedData,
      modifiedAt: readMarkdownModifiedAt(persistenceFields, kind)
    }
  }
})
