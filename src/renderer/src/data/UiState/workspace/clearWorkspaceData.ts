import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { markdownContentUiStateCollection } from '@renderer/data/Collections/MarkdownContentUiStateCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '@renderer/data/Collections/WorkspacePromptFolderUiStateCollection'
import { accordionUiStateCollection } from '@renderer/data/Collections/AccordionUiStateCollection'
import { clearPromptFolderClientStateCollection } from '@renderer/data/UiState/client-state/PromptFolderClientState'
import { clearPromptClientStateCollection } from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'
import { clearPromptTemplateClientStateCollection } from '@renderer/data/UiState/client-state/PromptTemplateClientStateMutations.svelte.ts'
import { promptEditorUiCache } from '@renderer/data/UiState/cache/PromptEditorUiCache.svelte.ts'
import { promptFolderUiCache } from '@renderer/data/UiState/cache/PromptFolderUiCache.svelte.ts'

/** Clears workspace memory after saves settle, preserving application-wide collections. */
export const clearWorkspaceData = (): void => {
  clearPromptFolderClientStateCollection()
  clearPromptClientStateCollection()
  clearPromptTemplateClientStateCollection()
  promptEditorUiCache.editorMeasuredHeight.clearAll()
  promptFolderUiCache.settingsRowMeasuredHeight.clearAll()

  // Clear records and revision metadata together so reopened disk snapshots are accepted.
  for (const collection of [
    workspaceCollection,
    promptFolderCollection,
    categoryCollection,
    promptCollection,
    promptTemplateCollection,
    markdownContentUiStateCollection,
    workspaceUiStateCollection,
    workspacePromptFolderUiStateCollection,
    accordionUiStateCollection
  ]) {
    collection.utils.clearAuthoritative()
  }
}
