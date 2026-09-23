import type { DragFinishResult } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
import {
  clearPromptEntryDrag,
  startPromptDrag
} from '@renderer/features/prompt-drag-drop/promptEntryDragState.svelte.ts'
import {
  resolvePromptDropPreviousEntryId,
  type PromptHandleDragPayload,
  type PromptHandleDropPayload
} from '@renderer/features/prompt-drag-drop/promptHandleDrag'
import { setPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import type { PromptFolder } from '@shared/domain/prompt-folder/PromptFolder'
import { getContentStatusFolders, getContentStatusFolderEntryStatus, getPromptStatusFolderDefinition, PROMPT_STATUS_FOLDER_REGISTRY, type PromptLocation, type PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { getMarkdownContentCategoryOrder } from '@shared/domain/markdown-content/MarkdownContent'

type PromptTreePromptDragControllerOptions = {
  getPromptFolders: () => PromptFolder[]
}

/** Resolved movement carrying one complete destination for the shared mutation. */
type PromptTreePromptDropResult = {
  sourcePromptFolderId: string
  promptId: string
  location: PromptLocation
}

const findPromptFolder = (promptFolders: PromptFolder[], folderId: string): PromptFolder | null => {
  return promptFolders.find((folder) => folder.id === folderId) ?? null
}

/** Returns active entry IDs from one exact root or category group. */
const getCategoryEntryIds = (
  promptFolder: PromptFolder,
  categoryId: string | null,
  statusFolderId: PromptStatusFolderId
): string[] =>
  getMarkdownContentCategoryOrder(promptFolder, statusFolderId).categories
    .find((group) => group.categoryId === categoryId)
    ?.entries.filter((entry) => entry.kind === promptFolder.kind)
    .map((entry) => entry.id) ?? []

/** Resolves a tree or editor drop into one complete prompt location. */
export const resolvePromptTreePromptMove = (
  promptFolders: PromptFolder[],
  sourcePayload: PromptHandleDragPayload,
  dropPayload: PromptHandleDropPayload | null
): PromptTreePromptDropResult | null => {
  if (!dropPayload) return null

  /** Exact source and destination workflow definitions. */
  const sourceGroup = getPromptStatusFolderDefinition(sourcePayload.location.status)
  const destinationGroup = PROMPT_STATUS_FOLDER_REGISTRY[dropPayload.statusSection]
  if (!getContentStatusFolders(sourcePayload.contentKind).some((group) => group.id === destinationGroup.id)) return null

  const sourcePromptFolder = findPromptFolder(promptFolders, sourcePayload.location.promptFolderId)
  const destinationPromptFolder = findPromptFolder(promptFolders, dropPayload.folderId)
  if (!sourcePromptFolder || !destinationPromptFolder) return null
  if (
    sourcePromptFolder.kind !== sourcePayload.contentKind ||
    destinationPromptFolder.kind !== sourcePayload.contentKind
  ) {
    return null
  }
  if (
    sourceGroup.ordering === 'finalizedAt' &&
    sourceGroup.id === dropPayload.statusSection
  ) {
    return null
  }
  /** Category retained by final statuses for later restoration. */
  const sourceCategoryId = sourcePayload.location.categoryId
  const destinationCategoryId = dropPayload.categoryId ?? null
  if (destinationGroup.ordering === 'finalizedAt') {
    return {
      sourcePromptFolderId: sourcePromptFolder.id,
      promptId: sourcePayload.fromId,
      location: {
        promptFolderId: destinationPromptFolder.id,
        categoryId: sourceCategoryId,
        previousEntryId: null,
        status: getContentStatusFolderEntryStatus(sourcePayload.contentKind, destinationGroup.id)
      }
    }
  }
  /** Category IDs act as logical containers for same-root cross-category no-op detection. */
  const sourceContentOwnerId = `${sourcePromptFolder.id}:${sourceGroup.id}:${sourceCategoryId ?? ''}`
  const destinationContentOwnerId = `${destinationPromptFolder.id}:${destinationGroup.id}:${destinationCategoryId ?? ''}`
  /** Exact predecessor after excluding no-op drops. */
  const previousEntryId = resolvePromptDropPreviousEntryId(
    sourceContentOwnerId,
    sourceGroup.ordering === 'finalizedAt'
      ? []
      : getCategoryEntryIds(sourcePromptFolder, sourceCategoryId, sourceGroup.id),
    sourcePayload.fromId,
    { ...dropPayload, folderId: destinationContentOwnerId },
    getCategoryEntryIds(destinationPromptFolder, destinationCategoryId, destinationGroup.id)
  )
  if (previousEntryId === undefined) return null

  return {
    sourcePromptFolderId: sourcePromptFolder.id,
    promptId: sourcePayload.fromId,
    location: {
      promptFolderId: destinationPromptFolder.id,
      categoryId: destinationCategoryId,
      previousEntryId,
      status: sourceGroup.id === destinationGroup.id ? sourcePayload.location.status : getContentStatusFolderEntryStatus(sourcePayload.contentKind, destinationGroup.id)
    }
  }
}

export const createPromptTreePromptDragController = ({
  getPromptFolders
}: PromptTreePromptDragControllerOptions) => {
  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    startPromptDrag(sourcePayload)
  }

  /** Resolves domain placement from a completed drag; cancelled drags supply no drop payload. */
  const handleDragFinish = ({
    sourcePayload,
    dropPayload
  }: Pick<DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>, 'sourcePayload' | 'dropPayload'>): void => {
    clearPromptEntryDrag()

    const result = resolvePromptTreePromptMove(getPromptFolders(), sourcePayload, dropPayload)
    if (!result) return

    void runIpcBestEffort(() => setPromptLocation(result.sourcePromptFolderId, result.promptId, result.location))
  }

  return {
    handleDragStart,
    handleDragFinish
  }
}
