import { attachedNoteUiStateCollection } from '@renderer/data/Collections/AttachedNoteUiStateCollection'
import { notesCollection } from '@renderer/data/Collections/NotesCollection'
import { deleteNoteClientStates } from '@renderer/data/UiState/client-state/NoteClientState'
import type { AuthoritativeSnapshot } from '@shared/ipc/AuthoritativeSnapshot'
import type { DomainEntityType } from '@shared/domain/DomainChanges'
import { createPromptFull, isPromptFull } from '@shared/domain/prompt/Prompt'
import { createPromptTemplateFull, isPromptTemplateFull } from '@shared/domain/prompt-template/PromptTemplate'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptClientState } from '@renderer/data/UiState/client-state/PromptClientState'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { promptTemplateClientState } from '@renderer/data/UiState/client-state/PromptTemplateClientState'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { clearPromptEditorMeasuredHeight } from '@renderer/data/UiState/cache/PromptEditorUiCache.svelte.ts'

/** Returns the renderer collection owning one registered entity's authoritative revision. */
export const getRendererRevisionCollection = (entityType: DomainEntityType) => {
  switch (entityType) {
    case 'attachedNoteUiState':
      return attachedNoteUiStateCollection
    case 'note':
      return notesCollection
    case 'systemSettings':
      return systemSettingsCollection
    case 'workspace':
      return workspaceCollection
    case 'promptCollection':
      return promptCollectionsCollection
    case 'category':
      return categoryCollection
    case 'prompt':
      return promptsCollection
    case 'promptTemplate':
      return promptTemplatesCollection
    case 'userPersistence':
      return userPersistenceCollection
    case 'workspaceUiState':
      return workspaceUiStateCollection
  }
}

/** Reconciles one authoritative snapshot into its registered renderer revision state. */
const reconcileRendererAuthoritativeSnapshot = (
  snapshot: AuthoritativeSnapshot
): void => {
  if ('deleted' in snapshot) {
    getRendererRevisionCollection(snapshot.entityType).utils.deleteAuthoritative(snapshot.id)
    if (snapshot.entityType === 'note') deleteNoteClientStates([snapshot.id])
    // Side effect: shared client-state deletes also clear the content's measured editor heights.
    if (snapshot.entityType === 'prompt') promptClientState.deleteClientStates([snapshot.id])
    if (snapshot.entityType === 'promptTemplate') {
      promptTemplateClientState.deleteClientStates([snapshot.id])
    }
    return
  }

  switch (snapshot.entityType) {
    case 'attachedNoteUiState':
      attachedNoteUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'note':
      notesCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'systemSettings':
      systemSettingsCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspace':
      workspaceCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'promptCollection':
      promptCollectionsCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'category':
      categoryCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'prompt': {
      /** Current renderer prompt inspected before authoritative text reconciliation. */
      const currentPrompt = promptsCollection.get(snapshot.id)
      if (
        !currentPrompt ||
        !isPromptFull(currentPrompt) ||
        currentPrompt.promptText !== snapshot.data.promptText
      ) {
        clearPromptEditorMeasuredHeight(snapshot.id)
      }
      /** Full prompt snapshot normalized for the renderer collection and client state. */
      const promptSnapshot = { ...snapshot, data: createPromptFull(snapshot.data) }
      promptsCollection.utils.upsertAuthoritative(promptSnapshot)
      promptClientState.upsertClientStates([snapshot])
      return
    }
    case 'promptTemplate': {
      /** Current renderer template inspected before authoritative text reconciliation. */
      const currentTemplate = promptTemplatesCollection.get(snapshot.id)
      if (
        !currentTemplate ||
        !isPromptTemplateFull(currentTemplate) ||
        currentTemplate.templateText !== snapshot.data.templateText
      ) {
        clearPromptEditorMeasuredHeight(snapshot.id)
      }
      /** Full template snapshot normalized for the renderer collection and client state. */
      const promptTemplateSnapshot = {
        ...snapshot,
        data: createPromptTemplateFull(snapshot.data)
      }
      promptTemplatesCollection.utils.upsertAuthoritative(promptTemplateSnapshot)
      promptTemplateClientState.upsertClientStates([snapshot])
      return
    }
    case 'userPersistence':
      userPersistenceCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspaceUiState':
      workspaceUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
  }
}

/** Reconciles an ordered authoritative snapshot response into renderer revision state. */
export const reconcileRendererAuthoritativeSnapshots = (
  snapshots: readonly AuthoritativeSnapshot[]
): void => {
  /** Next authoritative snapshot reconciled in response order. */
  for (const snapshot of snapshots) reconcileRendererAuthoritativeSnapshot(snapshot)
}
