import { attachedNoteUiStateCollection } from '@renderer/data/Collections/AttachedNoteUiStateCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { notesCollection } from '@renderer/data/Collections/NotesCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { markdownContentUiStateCollection } from '@renderer/data/Collections/MarkdownContentUiStateCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { workspacePromptCollectionUiStateCollection } from '@renderer/data/Collections/WorkspacePromptCollectionUiStateCollection'
import { accordionUiStateCollection } from '@renderer/data/Collections/AccordionUiStateCollection'
import { clearPromptCollectionClientStateCollection } from '@renderer/data/UiState/client-state/PromptCollectionClientState'
import { clearPromptClientStateCollection } from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'
import { clearPromptTemplateClientStateCollection } from '@renderer/data/UiState/client-state/PromptTemplateClientStateMutations.svelte.ts'
import { promptEditorUiCache } from '@renderer/data/UiState/cache/PromptEditorUiCache.svelte.ts'
import { promptCollectionUiCache } from '@renderer/data/UiState/cache/PromptCollectionUiCache.svelte.ts'

/** Clears workspace memory after saves settle, preserving application-wide collections. */
export const clearWorkspaceData = (): void => {
  clearPromptCollectionClientStateCollection()
  clearPromptClientStateCollection()
  clearPromptTemplateClientStateCollection()
  promptEditorUiCache.editorMeasuredHeight.clearAll()
  promptCollectionUiCache.settingsRowMeasuredHeight.clearAll()

  // Clear records and revision metadata together so reopened disk snapshots are accepted.
  for (const collection of [
    workspaceCollection,
    promptCollectionsCollection,
    categoryCollection,
    promptsCollection,
    notesCollection,
    promptTemplatesCollection,
    attachedNoteUiStateCollection,
    markdownContentUiStateCollection,
    workspaceUiStateCollection,
    workspacePromptCollectionUiStateCollection,
    accordionUiStateCollection
  ]) {
    collection.utils.clearAuthoritative()
  }
}
