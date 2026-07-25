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
import { getPromptFolderActiveEntryIds } from '@renderer/data/Collections/PromptFolderEntries'

type PromptTreePromptDragControllerOptions = {
  getPromptFolders: () => PromptFolder[]
  onPromptMove: (move: PromptHandleMove) => void
}

const findPromptFolder = (promptFolders: PromptFolder[], folderId: string): PromptFolder | null => {
  return promptFolders.find((folder) => folder.id === folderId) ?? null
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

    const promptFolders = getPromptFolders()
    const sourcePromptFolder = findPromptFolder(promptFolders, sourcePayload.sourceFolderId)
    if (!sourcePromptFolder) {
      return
    }

    const destinationFolder = dropPayload
      ? findPromptFolder(promptFolders, dropPayload.folderId)
      : null
    if (destinationFolder && destinationFolder.kind !== sourcePayload.contentKind) return

    const nextMove = resolvePromptHandleDropMove(
      sourcePromptFolder.id,
      getPromptFolderActiveEntryIds(sourcePromptFolder),
      sourcePayload.fromId,
      dropPayload,
      dropPayload
        ? ((): string[] | null => {
            return destinationFolder ? getPromptFolderActiveEntryIds(destinationFolder) : null
          })()
        : null
    )
    if (!nextMove) {
      return
    }

    void runIpcBestEffort(async () => {
      const move = sourcePayload.contentKind === 'template' ? movePromptTemplate : movePrompt
      await move(
          nextMove.sourcePromptFolderId,
          nextMove.destinationPromptFolderId,
          nextMove.promptId,
          nextMove.previousEntryId
        )
    })

    onPromptMove(nextMove)
  }

  return {
    handleDragStart,
    handleDragFinish
  }
}
