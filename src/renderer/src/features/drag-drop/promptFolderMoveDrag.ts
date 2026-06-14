import type { DragFinishResult } from './dragDrop.svelte.ts'
import {
  resolvePromptFolderRowDropMove,
  type PromptFolderRowDragPayload,
  type PromptFolderRowDropPayload
} from './promptFolderDrag'
import { movePromptFolder } from '@renderer/data/Mutations/WorkspaceMutations'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

type PromptFolderMoveDragControllerOptions = {
  getPromptFolderIds: () => string[]
  getWorkspaceId: () => string | null
}

export const createPromptFolderMoveDragController = ({
  getPromptFolderIds,
  getWorkspaceId
}: PromptFolderMoveDragControllerOptions) => {
  const handleDragFinish = ({
    sourcePayload,
    dropPayload
  }: DragFinishResult<PromptFolderRowDragPayload, PromptFolderRowDropPayload>): void => {
    const workspaceId = getWorkspaceId()
    if (!workspaceId) {
      return
    }

    const nextMove = resolvePromptFolderRowDropMove(
      getPromptFolderIds(),
      sourcePayload.folderId,
      dropPayload
    )
    if (!nextMove) {
      return
    }

    void runIpcBestEffort(async () => {
      await movePromptFolder(workspaceId, nextMove.folderId, nextMove.orderAfterFolderId)
    })
  }

  return {
    handleDragFinish
  }
}
