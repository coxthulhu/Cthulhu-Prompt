import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { categoryCollection } from '../Collections/CategoryCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { workspaceUiStateCollection } from '../Collections/WorkspaceUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '../Collections/WorkspacePromptFolderUiStateCollection'
import { accordionUiStateCollection } from '../Collections/AccordionUiStateCollection'
import { clearPromptFolderClientStateCollection } from './PromptFolderClientState'
import { clearPromptClientStateCollection } from './PromptClientStateMutations.svelte.ts'
import { clearPromptTemplateClientStateCollection } from './PromptTemplateClientStateMutations.svelte.ts'
import { promptEditorUiCache } from './PromptEditorUiCache.svelte.ts'
import { promptFolderUiCache } from './PromptFolderUiCache.svelte.ts'

/** Clears workspace memory after saves settle, preserving application-wide collections. */
export const clearWorkspaceStoreBridge = (): void => {
  clearPromptFolderClientStateCollection()
  clearPromptClientStateCollection()
  clearPromptTemplateClientStateCollection()
  promptEditorUiCache.editorMeasuredHeight.clearAll()
  promptFolderUiCache.settingsRowMeasuredHeight.clearAll()
  promptFolderUiCache.scrollTop.clearAll()

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
