import type { PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
import {
  getContentStatusFolders,
  getPromptStatusFolderDefinition,
  isPromptStatus,
  PROMPT_STATUS_FOLDER_REGISTRY,
  PromptStatusFolderId,
  type PromptContentStatus
} from '@shared/domain/prompt/Prompt'
import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'

/** Markdown content whose workflow metadata follows the status folder that contains it. */
type StatusFolderContent = {
  status?: PromptContentStatus
  finalizedAt?: string
}

/** Aligns loaded status and finalization with the physical status folder containing the file. */
export const normalizeContentForStatusFolder = <TContent extends StatusFolderContent>(
  content: TContent,
  folderPath: string,
  kind: PromptCollectionKind
): TContent => {
  /** Last path segment names the physical status folder. */
  const directoryName = folderPath.split(/[\\/]/).at(-1)
  /** Physical folder owning the file; unknown directories load as Active. */
  const statusFolder =
    getContentStatusFolders(kind).find((candidate) => candidate.directoryName === directoryName) ??
    PROMPT_STATUS_FOLDER_REGISTRY[PromptStatusFolderId.Active]
  /** Templates have one status per folder; prompts keep any status their folder owns. */
  const status: PromptContentStatus =
    kind === 'template'
      ? statusFolder.isFinal
        ? PromptTemplateStatus.Archived
        : PromptTemplateStatus.Active
      : content.status !== undefined &&
          isPromptStatus(content.status) &&
          getPromptStatusFolderDefinition(content.status).id === statusFolder.id
        ? content.status
        : statusFolder.entryStatus
  /** Finalization exists only in final folders and keeps any recorded time. */
  const { finalizedAt, ...unfinalizedContent } = content
  return {
    ...unfinalizedContent,
    status,
    ...(statusFolder.isFinal
      ? { finalizedAt: finalizedAt ?? getCurrentIsoSecondTimestamp() }
      : {})
  } as TContent
}

/** Whether status-folder normalization changed metadata that must be written back to disk. */
export const hasStatusFolderNormalizationChanges = (
  loaded: StatusFolderContent,
  normalized: StatusFolderContent
): boolean =>
  loaded.status !== normalized.status || loaded.finalizedAt !== normalized.finalizedAt
