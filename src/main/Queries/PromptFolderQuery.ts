import { ipcMain } from 'electron'
import type {
  LoadPromptFolderInitialPayload,
  LoadPromptFolderInitialResult
} from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'
import { getCategoryOrderCategoryIds } from '@shared/PromptFolder'
import {
  MarkdownContentUiStateDataAccess
} from '../DataAccess/MarkdownContentUiStateDataAccess'
import { createMarkdownContentUiStateKey } from '@shared/MarkdownContentUiState'
import { data } from '../Data/Data'
import {
  buildPromptFolderSnapshot,
  buildCategorySnapshot,
  getLoadedCategoryEntries,
  type PromptFolderCommittedEntry
} from '../Data/DataSnapshotHelpers'
import { parseLoadPromptFolderInitialRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'
import { loadPromptFolderMarkdownContents } from './MarkdownContentQueries'

export const loadPromptFolderInitialData = async (
  payload: LoadPromptFolderInitialPayload
): Promise<LoadPromptFolderInitialResult> => {
  const promptFolderEntry = data.promptFolder.committedStore.getEntry(payload.promptFolderId)

  if (!promptFolderEntry) {
    return { success: false, error: 'Prompt folder not loaded' }
  }

  if (promptFolderEntry.persistenceFields.workspaceId !== payload.workspaceId) {
    return { success: false, error: 'Prompt folder does not belong to the workspace' }
  }

  try {
    /** Single root folder loaded by the category-based screen. */
    const promptFolderIds = [payload.promptFolderId]
    const promptFolderEntries: PromptFolderCommittedEntry[] = []
    for (const promptFolderId of promptFolderIds) {
      const entry = data.promptFolder.committedStore.getEntry(promptFolderId)
      if (entry) promptFolderEntries.push(entry)
    }
    const promptFolders = promptFolderEntries.map(buildPromptFolderSnapshot)
    /** Root-owned category snapshots needed by prompt and template metadata rows. */
    const categories = getLoadedCategoryEntries(
      getCategoryOrderCategoryIds(promptFolderEntry.committed.categoryOrder)
    ).map(buildCategorySnapshot)
    const { promptIds, promptTemplateIds, prompts, promptTemplates } =
      loadPromptFolderMarkdownContents(promptFolders)
    const contentIds = [
      ...promptIds.filter(
        (promptId) =>
          data.prompt.committedStore.getEntry(promptId)?.committed.status !== PromptStatus.Completed
      ),
      ...promptTemplateIds
    ]
    const markdownContentUiStates =
      contentIds.length === 0
        ? []
        : MarkdownContentUiStateDataAccess.readMarkdownContentUiStates(
            payload.workspaceId,
            contentIds
          )
    return {
      success: true,
      promptFolders,
      categories,
      prompts,
      promptTemplates,
      markdownContentUiStates: markdownContentUiStates.map((uiState) => ({
        id: createMarkdownContentUiStateKey(uiState.workspaceId, uiState.contentId),
        revision: revisions.markdownContentUiState.get(
          createMarkdownContentUiStateKey(uiState.workspaceId, uiState.contentId)
        ),
        data: uiState
      }))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load prompt folder initial data' }
  }
}

export const setupPromptFolderQueryHandlers = (): void => {
  ipcMain.handle(
    'load-prompt-folder-initial',
    async (_, request: unknown): Promise<LoadPromptFolderInitialResult> => {
      return await runQueryIpcRequest(
        request,
        parseLoadPromptFolderInitialRequest,
        async (validatedRequest) => await loadPromptFolderInitialData(validatedRequest.payload)
      )
    }
  )
}
