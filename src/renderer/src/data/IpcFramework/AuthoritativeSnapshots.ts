import type { AuthoritativeSnapshot } from '@shared/AuthoritativeSnapshot'
import type { DomainEntityType } from '@shared/DomainChanges'
import { createPromptFull, isPromptFull } from '@shared/Prompt'
import { createPromptTemplateFull, isPromptTemplateFull } from '@shared/PromptTemplate'
import { accordionUiStateCollection } from '../Collections/AccordionUiStateCollection'
import { categoryCollection } from '../Collections/CategoryCollection'
import { categoryDescriptionEditorUiStateCollection } from '../Collections/CategoryDescriptionEditorUiStateCollection'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { promptClientStateCollection } from '../Collections/PromptClientStateCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { promptTemplateClientStateCollection } from '../Collections/PromptTemplateClientStateCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { workspacePromptFolderUiStateCollection } from '../Collections/WorkspacePromptFolderUiStateCollection'
import { workspaceUiStateCollection } from '../Collections/WorkspaceUiStateCollection'
import { clearPromptEditorMeasuredHeight } from '../UiState/PromptEditorUiCache.svelte.ts'

/** Returns the renderer collection owning one registered entity's authoritative revision. */
export const getRendererRevisionCollection = (entityType: DomainEntityType) => {
  switch (entityType) {
    case 'systemSettings':
      return systemSettingsCollection
    case 'workspace':
      return workspaceCollection
    case 'promptFolder':
      return promptFolderCollection
    case 'category':
      return categoryCollection
    case 'prompt':
      return promptCollection
    case 'promptTemplate':
      return promptTemplateCollection
    case 'userPersistence':
      return userPersistenceCollection
    case 'markdownContentUiState':
      return markdownContentUiStateCollection
    case 'workspaceUiState':
      return workspaceUiStateCollection
    case 'workspacePromptFolderUiState':
      return workspacePromptFolderUiStateCollection
    case 'accordionUiState':
      return accordionUiStateCollection
    case 'categoryDescriptionEditorUiState':
      return categoryDescriptionEditorUiStateCollection
  }
}

/** Reconciles one authoritative snapshot into its registered renderer revision state. */
const reconcileRendererAuthoritativeSnapshot = (
  snapshot: AuthoritativeSnapshot
): void => {
  if ('deleted' in snapshot) {
    getRendererRevisionCollection(snapshot.entityType).utils.deleteAuthoritative(snapshot.id)
    if (snapshot.entityType === 'prompt' && promptClientStateCollection.has(snapshot.id)) {
      promptClientStateCollection.delete(snapshot.id)
    }
    if (
      snapshot.entityType === 'promptTemplate' &&
      promptTemplateClientStateCollection.has(snapshot.id)
    ) {
      promptTemplateClientStateCollection.delete(snapshot.id)
    }
    return
  }

  switch (snapshot.entityType) {
    case 'systemSettings':
      systemSettingsCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspace':
      workspaceCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'promptFolder':
      promptFolderCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'category':
      categoryCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'prompt': {
      /** Current renderer prompt inspected before authoritative text reconciliation. */
      const currentPrompt = promptCollection.get(snapshot.id)
      if (
        !currentPrompt ||
        !isPromptFull(currentPrompt) ||
        currentPrompt.promptText !== snapshot.data.promptText
      ) {
        clearPromptEditorMeasuredHeight(snapshot.id)
      }
      /** Full prompt snapshot normalized for the renderer collection and client state. */
      const promptSnapshot = { ...snapshot, data: createPromptFull(snapshot.data) }
      promptCollection.utils.upsertAuthoritative(promptSnapshot)
      if (!promptClientStateCollection.has(snapshot.id)) {
        promptClientStateCollection.insert({ id: snapshot.id, isEdited: false })
      }
      return
    }
    case 'promptTemplate': {
      /** Current renderer template inspected before authoritative text reconciliation. */
      const currentTemplate = promptTemplateCollection.get(snapshot.id)
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
      promptTemplateCollection.utils.upsertAuthoritative(promptTemplateSnapshot)
      if (!promptTemplateClientStateCollection.has(snapshot.id)) {
        promptTemplateClientStateCollection.insert({ id: snapshot.id, isEdited: false })
      }
      return
    }
    case 'userPersistence':
      userPersistenceCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'markdownContentUiState':
      markdownContentUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspaceUiState':
      workspaceUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'workspacePromptFolderUiState':
      workspacePromptFolderUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'accordionUiState':
      accordionUiStateCollection.utils.upsertAuthoritative(snapshot)
      return
    case 'categoryDescriptionEditorUiState':
      categoryDescriptionEditorUiStateCollection.utils.upsertAuthoritative(snapshot)
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
