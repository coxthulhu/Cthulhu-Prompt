import { getCollectionNoteIds } from '@shared/domain/note/Note'
import { ipcMain } from 'electron'
import type {
  LoadPromptCollectionInitialPayload,
  LoadPromptCollectionInitialResult
} from '@shared/domain/prompt-collection/PromptCollection'
import { isFinalPromptStatus, PromptStatus } from '@shared/domain/prompt/Prompt'
import { getPromptCollectionCategoryIds } from '@shared/domain/prompt-collection/PromptCollection'
import { createMarkdownContentUiStateKey } from '@shared/domain/ui-state/MarkdownContentUiState'
import { data } from '../Data/Data'
import {
  buildNoteSnapshot,
  buildPromptCollectionSnapshot,
  buildCategorySnapshot,
  getLoadedCategoryEntries,
  type PromptCollectionCommittedEntry
} from '../Data/DataSnapshotHelpers'
import { parseLoadPromptCollectionInitialRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { loadPromptCollectionMarkdownContents } from './MarkdownContentQueries'

export const loadPromptCollectionInitialData = async (
  payload: LoadPromptCollectionInitialPayload
): Promise<LoadPromptCollectionInitialResult> => {
  const promptCollectionEntry = data.promptCollection.committedStore.getEntry(payload.promptCollectionId)

  if (!promptCollectionEntry) {
    return { success: false, error: 'Prompt collection not loaded' }
  }

  if (promptCollectionEntry.persistenceFields.workspaceId !== payload.workspaceId) {
    return { success: false, error: 'Prompt collection does not belong to the workspace' }
  }

  try {
    /** Single collection loaded by the category-based screen. */
    const promptCollectionIds = [payload.promptCollectionId]
    const promptCollectionEntries: PromptCollectionCommittedEntry[] = []
    for (const promptCollectionId of promptCollectionIds) {
      const entry = data.promptCollection.committedStore.getEntry(promptCollectionId)
      if (entry) promptCollectionEntries.push(entry)
    }
    const promptCollections = promptCollectionEntries.map(buildPromptCollectionSnapshot)
    /** Collection-owned category snapshots needed by prompt and template metadata rows. */
    const categories = getLoadedCategoryEntries(
      getPromptCollectionCategoryIds(promptCollectionEntry.committed)
    ).map(buildCategorySnapshot)
    const { promptIds, promptTemplateIds, prompts, promptTemplates } =
      loadPromptCollectionMarkdownContents(promptCollections)
    const contentIds = [
      ...promptIds.filter(
        (promptId) =>
          !isFinalPromptStatus(
            data.prompt.committedStore.getEntry(promptId)?.committed.status ??
              PromptStatus.Todo
          )
      ),
      ...promptTemplateIds
    ]
    // Side effect: hydrate SQLite-backed editor state into the shared committed stores.
    await Promise.all(
      contentIds.map((contentId) =>
        data.markdownContentUiState.loadDataFromPersistence(
          createMarkdownContentUiStateKey(payload.workspaceId, contentId),
          {}
        )
      )
    )
    /** Loaded editor UI-state entries returned through revision envelopes. */
    const markdownContentUiStates = contentIds.flatMap((contentId) => {
      /** Composite authoritative key for the current content record. */
      const id = createMarkdownContentUiStateKey(payload.workspaceId, contentId)
      /** Committed SQLite entry when this content has saved editor state. */
      const entry = data.markdownContentUiState.committedStore.getEntry(id)
      return entry ? [{ id, revision: entry.revision, data: entry.committed }] : []
    })
    return {
      success: true,
      promptCollections,
      categories,
      prompts,
      promptTemplates,
      notes: getCollectionNoteIds({
        get: (type, id) => data[type].committedStore.getEntry(id)?.committed as never,
        getAll: (type) => data[type].committedStore.getAllEntries().map((entry) => entry.committed) as never
      }, promptCollectionEntry.committed).flatMap((id) => {
        /** Loaded note snapshot carries full text for future editors. */
        const entry = data.note.committedStore.getEntry(id)
        return entry ? [buildNoteSnapshot(entry)] : []
      }),
      markdownContentUiStates
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load prompt collection initial data' }
  }
}

export const setupPromptCollectionQueryHandlers = (): void => {
  ipcMain.handle(
    'load-prompt-collection-initial',
    async (_, request: unknown): Promise<LoadPromptCollectionInitialResult> => {
      return await runQueryIpcRequest(
        request,
        parseLoadPromptCollectionInitialRequest,
        async (validatedRequest) => await loadPromptCollectionInitialData(validatedRequest.payload)
      )
    }
  )
}
