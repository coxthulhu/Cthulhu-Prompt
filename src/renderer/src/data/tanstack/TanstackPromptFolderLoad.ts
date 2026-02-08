import type {
  TanstackLoadPromptFolderInitialPayload,
  TanstackLoadPromptFolderInitialResult
} from '@shared/tanstack/TanstackPromptFolderLoad'
import { tanstackIpcInvokeWithPayload } from './TanstackIpcInvoke'
import { runTanstackLoad } from './TanstackLoad'
import { tanstackPromptCollection } from './TanstackPromptCollection'
import { tanstackPromptFolderCollection } from './TanstackPromptFolderCollection'

export const loadTanstackPromptFolderInitial = async (
  workspaceId: string,
  promptFolderId: string
): Promise<void> => {
  const previousPromptIds = new Set(
    tanstackPromptFolderCollection.get(promptFolderId)?.promptIds ?? []
  )

  const result = await runTanstackLoad(() =>
    tanstackIpcInvokeWithPayload<
      TanstackLoadPromptFolderInitialResult,
      TanstackLoadPromptFolderInitialPayload
    >('tanstack-load-prompt-folder-initial', {
      workspaceId,
      promptFolderId
    })
  )

  tanstackPromptFolderCollection.utils.upsertAuthoritative(result.promptFolder)

  for (const prompt of result.prompts) {
    tanstackPromptCollection.utils.upsertAuthoritative(prompt)
  }

  const nextPromptIds = new Set(result.promptFolder.data.promptIds)

  for (const previousPromptId of previousPromptIds) {
    if (!nextPromptIds.has(previousPromptId)) {
      tanstackPromptCollection.utils.deleteAuthoritative(previousPromptId)
    }
  }
}
