import type { DragFinishResult } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
import {
  clearDraggedPromptRow,
  setDraggedPromptRow
} from '@renderer/features/drag-drop/promptDragState.svelte.ts'
import {
  resolvePromptHandleDropMove,
  type PromptHandleMove,
  type PromptHandleDragPayload,
  type PromptHandleDropPayload
} from '@renderer/features/drag-drop/promptHandleDrag'
import { movePrompt } from '@renderer/data/Mutations/PromptMutations'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import type { PromptFolder } from '@shared/PromptFolder'

type PromptTreePromptDragControllerOptions = {
  getPromptFolders: () => PromptFolder[]
  getPromptIdsForFolder: (promptFolder: PromptFolder) => string[]
  onPromptMove: (move: PromptHandleMove) => void
}

const findPromptFolder = (promptFolders: PromptFolder[], folderId: string): PromptFolder | null => {
  return promptFolders.find((folder) => folder.id === folderId) ?? null
}

export const createPromptTreePromptDragController = ({
  getPromptFolders,
  getPromptIdsForFolder,
  onPromptMove
}: PromptTreePromptDragControllerOptions) => {
  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    setDraggedPromptRow(sourcePayload)
  }

  const handleDragFinish = ({
    sourcePayload,
    dropPayload
  }: DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>): void => {
    clearDraggedPromptRow()

    const promptFolders = getPromptFolders()
    const sourcePromptFolder = findPromptFolder(promptFolders, sourcePayload.sourceFolderId)
    if (!sourcePromptFolder) {
      return
    }

    const nextMove = resolvePromptHandleDropMove(
      sourcePromptFolder.id,
      getPromptIdsForFolder(sourcePromptFolder),
      sourcePayload.fromId,
      dropPayload,
      dropPayload?.kind === 'prompt'
        ? (((): string[] | null => {
            const promptFolder = findPromptFolder(promptFolders, dropPayload.folderId)
            return promptFolder ? getPromptIdsForFolder(promptFolder) : null
          })())
        : getPromptIdsForFolder(sourcePromptFolder)
    )
    if (!nextMove) {
      return
    }

    void runIpcBestEffort(async () => {
      await movePrompt(
        nextMove.sourcePromptFolderId,
        nextMove.destinationPromptFolderId,
        nextMove.promptId,
        nextMove.orderAfterPromptId
      )
    })

    onPromptMove(nextMove)
  }

  return {
    handleDragStart,
    handleDragFinish
  }
}
