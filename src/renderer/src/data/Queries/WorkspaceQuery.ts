import { createPromptSummary } from '@shared/Prompt'
import { createPromptTemplateSummary } from '@shared/PromptTemplate'
import type { LoadWorkspaceByPathRequest, LoadWorkspaceByPathResult } from '@shared/Workspace'
import { promptCollection } from '../Collections/PromptCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getPromptFolderAllPromptIds } from '../Collections/PromptFolderEntries'
import {
  deletePromptFolderDrafts,
  upsertPromptFolderDrafts
} from '../UiState/PromptFolderDraftMutations.svelte.ts'
import {
  deletePromptDrafts,
  upsertPromptSummaryDrafts
} from '../UiState/PromptDraftMutations.svelte.ts'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'

export const loadWorkspaceByPath = async (workspaceInfoPath: string): Promise<string> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspaceByPathResult, LoadWorkspaceByPathRequest>(
      'load-workspace-by-path',
      {
        workspaceInfoPath
      }
    )
  )

  const previousWorkspace = workspaceCollection.get(result.workspace.id)
  const previousPromptIds = new Set<string>()
  const previousPromptTemplateIds = new Set<string>()
  const previousPromptFolderIds = new Set<string>()
  if (previousWorkspace) {
    const visitFolder = (promptFolderId: string): void => {
      if (previousPromptFolderIds.has(promptFolderId)) return
      previousPromptFolderIds.add(promptFolderId)
      const promptFolder = promptFolderCollection.get(promptFolderId)
      if (!promptFolder) return

      for (const promptId of getPromptFolderAllPromptIds(promptFolder)) {
        previousPromptIds.add(promptId)
      }

      for (const entry of promptFolder.entries) {
        if (entry.kind === 'template') previousPromptTemplateIds.add(entry.id)
        if (entry.kind === 'folder') visitFolder(entry.id)
      }
    }

    for (const entry of [...previousWorkspace.entries, ...previousWorkspace.templateEntries]) {
      visitFolder(entry.id)
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
  promptTemplateCollection.utils.upsertManyAuthoritative(
    result.promptTemplates.map((template) => ({
      ...template,
      data: createPromptTemplateSummary(template.data)
    }))
  )
  upsertPromptSummaryDrafts(result.prompts.map((prompt) => prompt.data))

  if (!previousWorkspace) {
    return result.workspace.id
  }

  const nextPromptFolderIds = new Set(result.promptFolders.map((folder) => folder.id))
  const removedPromptFolderIds: string[] = []

  for (const promptFolderId of previousPromptFolderIds) {
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

  const nextPromptTemplateIds = new Set(result.promptTemplates.map((template) => template.id))
  const removedPromptTemplateIds = [...previousPromptTemplateIds].filter(
    (templateId) => !nextPromptTemplateIds.has(templateId)
  )
  promptTemplateCollection.utils.deleteManyAuthoritative(removedPromptTemplateIds)

  return result.workspace.id
}
