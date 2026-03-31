import type { PromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
import type { DragFinishResult } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
import {
  clearDraggedPromptHighlight,
  highlightDraggedPrompt
} from '@renderer/features/drag-drop/promptDragHighlight'
import {
  resolvePromptHandleDropMove,
  type PromptHandleDragPayload,
  type PromptHandleDropPayload
} from '@renderer/features/drag-drop/promptHandleDrag'
import { movePrompt } from '@renderer/data/Mutations/PromptMutations'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import type { PromptFolder } from '@shared/PromptFolder'

type PromptTreePromptDragControllerOptions = {
  getPromptFolders: () => PromptFolder[]
  promptNavigation: PromptNavigationContext
}

const findPromptFolder = (promptFolders: PromptFolder[], folderId: string): PromptFolder | null => {
  return promptFolders.find((folder) => folder.id === folderId) ?? null
}

export const createPromptTreePromptDragController = ({
  getPromptFolders,
  promptNavigation
}: PromptTreePromptDragControllerOptions) => {
  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    highlightDraggedPrompt(promptNavigation, sourcePayload)
  }

  const handleDragFinish = ({
    sourcePayload,
    dropPayload
  }: DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>): void => {
    clearDraggedPromptHighlight(promptNavigation)

    const promptFolders = getPromptFolders()
    const sourcePromptFolder = findPromptFolder(promptFolders, sourcePayload.sourceFolderId)
    if (!sourcePromptFolder) {
      return
    }

    const nextMove = resolvePromptHandleDropMove(
      sourcePromptFolder.id,
      sourcePromptFolder.promptIds,
      sourcePayload.fromId,
      dropPayload,
      dropPayload?.kind === 'prompt'
        ? (findPromptFolder(promptFolders, dropPayload.folderId)?.promptIds ?? null)
        : sourcePromptFolder.promptIds
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
  }

  return {
    handleDragStart,
    handleDragFinish
  }
}
