import type { PromptFolderContentKind } from '@shared/PromptFolder'
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
  kind: PromptFolderContentKind
  getDisplayTitle: (data: TData) => string
  parseMarkdown: (fileText: string) => TData | null
  serializeMarkdown: (data: TData) => string
  normalizeLoadedData?: (data: TData, folderPath: string) => TData
  shouldRewriteNormalizedData?: (
    loaded: TData,
    normalized: TData,
    fileText: string
  ) => boolean
}

export const readMarkdownModifiedAt = (
  persistenceFields: MarkdownPersistenceFields,
  kind: PromptFolderContentKind
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
  stageChanges: async (transition) => {
    /** Current record whose resolved path is removed or replaced. */
    const before = transition.before
    /** Desired record whose data and resolved path are written. */
    const after = transition.after
    if (!before && !after) throw new Error('Markdown persistence transition is empty')
    /** Current markdown folder path when the entity already exists. */
    const currentFolderPath = before
      ? resolvePromptFolderPath(
          before.persistenceFields.workspacePath,
          before.persistenceFields.folderPath,
          kind
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
    const targetFolderPath = resolvePromptFolderPath(
      fields.workspacePath,
      fields.folderPath,
      kind
    )
    const stem = buildPromptStem(
      getDisplayTitle(after.data),
      after.data.id,
      fields.needsFilenameIdSuffix
    )
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

    return createPersistenceStageResult(fileChanges, {
      ...fields,
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

    // Source text is retained so kind-specific startup migrations can request a rewrite.
    const fileText = fs.readFileSync(filePaths.markdownPath, 'utf8')
    const loadedData = parseMarkdown(fileText)
    if (!loadedData) return null

    const normalizedData = normalizeLoadedData(loadedData, persistenceFields.folderPath)
    if (shouldRewriteNormalizedData(loadedData, normalizedData, fileText)) {
      fs.writeFileSync(filePaths.markdownPath, serializeMarkdown(normalizedData), 'utf8')
    }

    return {
      ...normalizedData,
      modifiedAt: readMarkdownModifiedAt(persistenceFields, kind)
    }
  }
})
