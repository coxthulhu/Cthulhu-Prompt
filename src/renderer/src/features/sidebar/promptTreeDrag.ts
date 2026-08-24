import type { DragFinishResult } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
import {
  clearPromptEntryDrag,
  startPromptDrag
} from '@renderer/features/drag-drop/promptEntryDragState.svelte.ts'
import {
  resolvePromptHandleDropMove,
  type PromptHandleMove,
  type PromptHandleDragPayload,
  type PromptHandleDropPayload
} from '@renderer/features/drag-drop/promptHandleDrag'
import { movePrompt } from '@renderer/data/Mutations/PromptMutations'
import { movePromptTemplate } from '@renderer/data/Mutations/PromptTemplateMutations'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import type { PromptFolder } from '@shared/PromptFolder'

type PromptTreePromptDragControllerOptions = {
  getPromptFolders: () => PromptFolder[]
  onPromptMove?: (move: PromptHandleMove, sourceCategoryId: string | null) => void
}

const findPromptFolder = (promptFolders: PromptFolder[], folderId: string): PromptFolder | null => {
  return promptFolders.find((folder) => folder.id === folderId) ?? null
}

/** Finds the exact category group containing an active prompt or template. */
const findEntryCategoryId = (promptFolder: PromptFolder, entryId: string): string | null =>
  promptFolder.categoryOrder.categories.find((group) =>
    group.entries.some((entry) => entry.id === entryId)
  )?.categoryId ?? null

/** Returns active entry IDs from one exact root or category group. */
const getCategoryEntryIds = (
  promptFolder: PromptFolder,
  categoryId: string | null
): string[] =>
  promptFolder.categoryOrder.categories
    .find((group) => group.categoryId === categoryId)
    ?.entries.filter((entry) => entry.kind === promptFolder.kind)
    .map((entry) => entry.id) ?? []

export const resolvePromptTreePromptMove = (
  promptFolders: PromptFolder[],
  sourcePayload: PromptHandleDragPayload,
  dropPayload: PromptHandleDropPayload | null
): { move: PromptHandleMove; sourceCategoryId: string | null } | null => {
  if (!dropPayload) return null

  const sourcePromptFolder = findPromptFolder(promptFolders, sourcePayload.sourceFolderId)
  const destinationPromptFolder = findPromptFolder(promptFolders, dropPayload.folderId)
  if (!sourcePromptFolder || !destinationPromptFolder) return null
  if (
    sourcePromptFolder.kind !== sourcePayload.contentKind ||
    destinationPromptFolder.kind !== sourcePayload.contentKind
  ) {
    return null
  }

  const sourceCategoryId =
    sourcePayload.sourceCategoryId ??
    findEntryCategoryId(sourcePromptFolder, sourcePayload.fromId)
  const destinationCategoryId = dropPayload.categoryId ?? null
  /** Category IDs act as logical containers for same-root cross-category no-op detection. */
  const sourceContentOwnerId = sourceCategoryId ?? sourcePromptFolder.id
  const destinationContentOwnerId = destinationCategoryId ?? destinationPromptFolder.id
  const resolvedMove = resolvePromptHandleDropMove(
    sourceContentOwnerId,
    getCategoryEntryIds(sourcePromptFolder, sourceCategoryId),
    sourcePayload.fromId,
    { ...dropPayload, folderId: destinationContentOwnerId },
    getCategoryEntryIds(destinationPromptFolder, destinationCategoryId)
  )
  if (!resolvedMove) return null

  return {
    move: {
      ...resolvedMove,
      sourcePromptFolderId: sourcePromptFolder.id,
      destinationPromptFolderId: destinationPromptFolder.id,
      categoryId: destinationCategoryId
    },
    sourceCategoryId
  }
}

export const createPromptTreePromptDragController = ({
  getPromptFolders,
  onPromptMove
}: PromptTreePromptDragControllerOptions) => {
  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    startPromptDrag(sourcePayload)
  }

  const handleDragFinish = ({
    sourcePayload,
    dropPayload
  }: DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>): void => {
    clearPromptEntryDrag()

    const result = resolvePromptTreePromptMove(getPromptFolders(), sourcePayload, dropPayload)
    if (!result) return

    void runIpcBestEffort(async () => {
      const move = sourcePayload.contentKind === 'template' ? movePromptTemplate : movePrompt
      await move(
        result.move.sourcePromptFolderId,
        result.move.destinationPromptFolderId,
        result.move.promptId,
        result.move.previousEntryId,
        result.move.categoryId
      )
      onPromptMove?.(result.move, result.sourceCategoryId)
    })
  }

  return {
    handleDragStart,
    handleDragFinish
  }
}
