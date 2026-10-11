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
import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { getContentStatusFolders, getContentStatusFolderEntryStatus, getPromptStatusFolderDefinition, PROMPT_STATUS_FOLDER_REGISTRY, type PromptLocation, type PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { getMarkdownContentCategoryOrder } from '@shared/domain/markdown-content/MarkdownContent'

type PromptTreePromptDragControllerOptions = {
  getPromptCollections: () => PromptCollection[]
}

/** Resolved movement carrying one complete destination for the shared mutation. */
type PromptTreePromptDropResult = {
  sourcePromptCollectionId: string
  promptId: string
  location: PromptLocation
}

const findPromptCollection = (promptCollections: PromptCollection[], collectionId: string): PromptCollection | null => {
  return promptCollections.find((collection) => collection.id === collectionId) ?? null
}

/** Returns active entry IDs from one exact collection or category group. */
const getCategoryEntryIds = (
  promptCollection: PromptCollection,
  categoryId: string | null,
  statusFolderId: PromptStatusFolderId
): string[] =>
  getMarkdownContentCategoryOrder(promptCollection, statusFolderId).categories
    .find((group) => group.categoryId === categoryId)
    ?.entries.filter((entry) => entry.kind === promptCollection.kind)
    .map((entry) => entry.id) ?? []

/** Resolves a tree or editor drop into one complete prompt location. */
export const resolvePromptTreePromptMove = (
  promptCollections: PromptCollection[],
  sourcePayload: PromptHandleDragPayload,
  dropPayload: PromptHandleDropPayload | null
): PromptTreePromptDropResult | null => {
  if (!dropPayload) return null

  /** Exact source and destination workflow definitions. */
  const sourceGroup = getPromptStatusFolderDefinition(sourcePayload.location.status)
  const destinationGroup = PROMPT_STATUS_FOLDER_REGISTRY[dropPayload.statusSection]
  if (!getContentStatusFolders(sourcePayload.contentKind).some((group) => group.id === destinationGroup.id)) return null

  const sourcePromptCollection = findPromptCollection(promptCollections, sourcePayload.location.promptCollectionId)
  const destinationPromptCollection = findPromptCollection(promptCollections, dropPayload.collectionId)
  if (!sourcePromptCollection || !destinationPromptCollection) return null
  if (
    sourcePromptCollection.kind !== sourcePayload.contentKind ||
    destinationPromptCollection.kind !== sourcePayload.contentKind
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
      sourcePromptCollectionId: sourcePromptCollection.id,
      promptId: sourcePayload.fromId,
      location: {
        promptCollectionId: destinationPromptCollection.id,
        categoryId: sourceCategoryId,
        previousEntryId: null,
        status: getContentStatusFolderEntryStatus(sourcePayload.contentKind, destinationGroup.id)
      }
    }
  }
  /** Category IDs act as logical containers for same-collection cross-category no-op detection. */
  const sourceContentOwnerId = `${sourcePromptCollection.id}:${sourceGroup.id}:${sourceCategoryId ?? ''}`
  const destinationContentOwnerId = `${destinationPromptCollection.id}:${destinationGroup.id}:${destinationCategoryId ?? ''}`
  /** Exact predecessor after excluding no-op drops. */
  const previousEntryId = resolvePromptDropPreviousEntryId(
    sourceContentOwnerId,
    sourceGroup.ordering === 'finalizedAt'
      ? []
      : getCategoryEntryIds(sourcePromptCollection, sourceCategoryId, sourceGroup.id),
    sourcePayload.fromId,
    { ...dropPayload, collectionId: destinationContentOwnerId },
    getCategoryEntryIds(destinationPromptCollection, destinationCategoryId, destinationGroup.id)
  )
  if (previousEntryId === undefined) return null

  return {
    sourcePromptCollectionId: sourcePromptCollection.id,
    promptId: sourcePayload.fromId,
    location: {
      promptCollectionId: destinationPromptCollection.id,
      categoryId: destinationCategoryId,
      previousEntryId,
      status: sourceGroup.id === destinationGroup.id ? sourcePayload.location.status : getContentStatusFolderEntryStatus(sourcePayload.contentKind, destinationGroup.id)
    }
  }
}

export const createPromptTreePromptDragController = ({
  getPromptCollections
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

    const result = resolvePromptTreePromptMove(getPromptCollections(), sourcePayload, dropPayload)
    if (!result) return

    void runIpcBestEffort(() => setPromptLocation(result.sourcePromptCollectionId, result.promptId, result.location))
  }

  return {
    handleDragStart,
    handleDragFinish
  }
}
