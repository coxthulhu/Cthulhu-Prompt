import { createPromptSummary } from '@shared/Prompt'
import type { LoadWorkspaceByPathRequest, LoadWorkspaceByPathResult } from '@shared/Workspace'
import { promptCollection } from '../Collections/PromptCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import {
  deletePromptFolderDrafts,
  upsertPromptFolderDrafts
} from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { deletePromptDrafts } from '../UiState/PromptDraftMutations.svelte.ts'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export const loadWorkspaceByPath = async (workspacePath: string): Promise<string> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspaceByPathResult, LoadWorkspaceByPathRequest>(
      'load-workspace-by-path',
      {
        workspacePath
      }
    )
  )

  const previousWorkspace = workspaceCollection.get(result.workspace.id)
  const previousPromptIds = new Set<string>()
  if (previousWorkspace) {
    for (const promptFolderId of previousWorkspace.promptFolderIds) {
      const promptFolder = promptFolderCollection.get(promptFolderId)
      if (!promptFolder) {
        continue
      }

      for (const promptId of promptFolder.promptIds) {
        previousPromptIds.add(promptId)
      }
    }
  }

  workspaceCollection.utils.upsertAuthoritative(result.workspace)

  for (const promptFolder of result.promptFolders) {
    promptFolderCollection.utils.upsertAuthoritative(promptFolder)
  }
  upsertPromptFolderDrafts(result.promptFolders.map((promptFolder) => promptFolder.data))
  promptCollection.utils.upsertManyAuthoritative(
    result.prompts.map((prompt) => ({
      ...prompt,
      data: createPromptSummary(prompt.data)
    }))
  )

  if (!previousWorkspace) {
    return result.workspace.id
  }

  const nextPromptFolderIds = new Set(result.workspace.data.promptFolderIds)
  const removedPromptFolderIds: string[] = []

  for (const promptFolderId of previousWorkspace.promptFolderIds) {
    if (!nextPromptFolderIds.has(promptFolderId)) {
      promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
      removedPromptFolderIds.push(promptFolderId)
    }
  }
  deletePromptFolderDrafts(removedPromptFolderIds)

  const nextPromptIds = new Set(result.prompts.map((prompt) => prompt.id))
  const removedPromptIds: string[] = []

  for (const previousPromptId of previousPromptIds) {
    if (!nextPromptIds.has(previousPromptId)) {
      removedPromptIds.push(previousPromptId)
    }
  }

  promptCollection.utils.deleteManyAuthoritative(removedPromptIds)
  deletePromptDrafts(removedPromptIds)

  return result.workspace.id
}
