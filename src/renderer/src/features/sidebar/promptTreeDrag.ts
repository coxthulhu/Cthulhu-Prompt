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
import { movePrompt, setPromptStatus } from '@renderer/data/Mutations/PromptMutations'
import { movePromptTemplate } from '@renderer/data/Mutations/PromptTemplateMutations'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import type { PromptFolder } from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'
import { getMarkdownContentCategoryOrder } from '@shared/MarkdownContent'

type PromptTreePromptDragControllerOptions = {
  getPromptFolders: () => PromptFolder[]
}

/** Resolved prompt drop with an optional status transition handled instead of a normal move. */
type PromptTreePromptDropResult = {
  move: PromptHandleMove
  targetStatus: PromptStatus | null
}

const findPromptFolder = (promptFolders: PromptFolder[], folderId: string): PromptFolder | null => {
  return promptFolders.find((folder) => folder.id === folderId) ?? null
}

/** Finds the exact category group containing an active prompt or template. */
const findEntryCategoryId = (promptFolder: PromptFolder, entryId: string): string | null =>
  getMarkdownContentCategoryOrder(promptFolder).categories.find((group) =>
    group.entries.some((entry) => entry.id === entryId)
  )?.categoryId ?? null

/** Returns active entry IDs from one exact root or category group. */
const getCategoryEntryIds = (
  promptFolder: PromptFolder,
  categoryId: string | null
): string[] =>
  getMarkdownContentCategoryOrder(promptFolder).categories
    .find((group) => group.categoryId === categoryId)
    ?.entries.filter((entry) => entry.kind === promptFolder.kind)
    .map((entry) => entry.id) ?? []

export const resolvePromptTreePromptMove = (
  promptFolders: PromptFolder[],
  sourcePayload: PromptHandleDragPayload,
  dropPayload: PromptHandleDropPayload | null
): PromptTreePromptDropResult | null => {
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
  if (sourcePayload.statusSection === 'completed' && dropPayload.statusSection === 'completed') {
    return null
  }
  if (
    sourcePayload.statusSection !== dropPayload.statusSection &&
    sourcePayload.contentKind !== 'prompt'
  ) {
    return null
  }

  const sourceCategoryId =
    sourcePayload.sourceCategoryId ??
    findEntryCategoryId(sourcePromptFolder, sourcePayload.fromId)
  const destinationCategoryId = dropPayload.categoryId ?? null
  if (dropPayload.statusSection === 'completed') {
    return {
      move: {
        sourcePromptFolderId: sourcePromptFolder.id,
        destinationPromptFolderId: destinationPromptFolder.id,
        promptId: sourcePayload.fromId,
        categoryId: sourceCategoryId,
        previousEntryId: null
      },
      targetStatus: PromptStatus.Completed
    }
  }
  /** Category IDs act as logical containers for same-root cross-category no-op detection. */
  const sourceContentOwnerId =
    sourcePayload.statusSection === 'completed'
      ? `${sourcePromptFolder.id}:completed`
      : (sourceCategoryId ?? sourcePromptFolder.id)
  const destinationContentOwnerId = destinationCategoryId ?? destinationPromptFolder.id
  const resolvedMove = resolvePromptHandleDropMove(
    sourceContentOwnerId,
    sourcePayload.statusSection === 'completed'
      ? []
      : getCategoryEntryIds(sourcePromptFolder, sourceCategoryId),
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
    targetStatus:
      sourcePayload.statusSection === 'completed' ? PromptStatus.Todo : null
  }
}

export const createPromptTreePromptDragController = ({
  getPromptFolders
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
      if (result.targetStatus) {
        await setPromptStatus(
          result.move.sourcePromptFolderId,
          result.move.destinationPromptFolderId,
          result.move.promptId,
          result.targetStatus,
          result.targetStatus === PromptStatus.Todo
            ? {
                categoryId: result.move.categoryId,
                previousEntryId: result.move.previousEntryId
              }
            : undefined
        )
        return
      }
      const move = sourcePayload.contentKind === 'template' ? movePromptTemplate : movePrompt
      await move(
        result.move.sourcePromptFolderId,
        result.move.destinationPromptFolderId,
        result.move.promptId,
        result.move.previousEntryId,
        result.move.categoryId
      )
    })
  }

  return {
    handleDragStart,
    handleDragFinish
  }
}
