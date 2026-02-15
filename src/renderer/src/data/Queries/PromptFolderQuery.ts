import type {
  LoadPromptFolderInitialPayload,
  LoadPromptFolderInitialResult
} from '@shared/PromptFolder'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'

export const loadPromptFolderInitial = async (
  workspaceId: string,
  promptFolderId: string
): Promise<void> => {
  const previousPromptIds = new Set(
    promptFolderCollection.get(promptFolderId)?.promptIds ?? []
  )

  const result = await runLoad(() =>
    ipcInvokeWithPayload<
      LoadPromptFolderInitialResult,
      LoadPromptFolderInitialPayload
    >('load-prompt-folder-initial', {
      workspaceId,
      promptFolderId
    })
  )

  promptFolderCollection.utils.upsertAuthoritative(result.promptFolder)
  promptCollection.utils.upsertManyAuthoritative(result.prompts)

  const nextPromptIds = new Set(result.promptFolder.data.promptIds)
  const removedPromptIds: string[] = []

  for (const previousPromptId of previousPromptIds) {
    if (!nextPromptIds.has(previousPromptId)) {
      removedPromptIds.push(previousPromptId)
    }
  }

  promptCollection.utils.deleteManyAuthoritative(removedPromptIds)
}
