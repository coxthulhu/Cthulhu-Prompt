import type { WorkspaceScreenSelection } from '@shared/UserPersistence'
import {
  createAccordionUiStateKey,
  createCategoryDescriptionEditorUiStateKey,
  createWorkspacePromptFolderUiStateKey,
  type AccordionUiState,
  type CategoryDescriptionEditorUiState,
  type WorkspacePromptFolderUiState,
  type WorkspaceUiState
} from '@shared/UiState'
import {
  planSetAccordionUiStateDomainMutation,
  planSetCategoryDescriptionEditorUiStateDomainMutation,
  planSetWorkspacePromptFolderUiStateDomainMutation,
  planSetWorkspaceUiStateDomainMutation,
  type SetCategoryDescriptionEditorUiStateDomainCommand
} from '@shared/UiStateDomainMutations'
import { workspaceUiStateCollection } from '../Collections/WorkspaceUiStateCollection'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '../IpcFramework/RendererDomainMutation'

/** Queues one complete workspace-level UI-state replacement. */
export const setWorkspaceUiStateWithAutosave = (
  uiState: WorkspaceUiState,
  debounceMs: number
): void => {
  mutatePacedRendererDomainMutation({
    mutation: { command: uiState, plan: planSetWorkspaceUiStateDomainMutation },
    ipc: { channel: 'set-workspace-ui-state' },
    renderer: {},
    pacing: {
      target: { entityType: 'workspaceUiState', id: uiState.workspaceId },
      debounceMs
    }
  })
}

/** Queues one complete prompt-folder view UI-state replacement. */
export const setWorkspacePromptFolderUiStateWithAutosave = (
  uiState: WorkspacePromptFolderUiState,
  debounceMs: number
): void => {
  /** Composite target ID shared with the revision collection. */
  const id = createWorkspacePromptFolderUiStateKey(
    uiState.workspaceId,
    uiState.contentOwnerId
  )
  mutatePacedRendererDomainMutation({
    mutation: { command: uiState, plan: planSetWorkspacePromptFolderUiStateDomainMutation },
    ipc: { channel: 'set-workspace-prompt-folder-ui-state' },
    renderer: {},
    pacing: {
      target: { entityType: 'workspacePromptFolderUiState', id },
      debounceMs
    }
  })
}

/** Queues one complete accordion UI-state replacement. */
export const setAccordionUiStateWithAutosave = (
  uiState: AccordionUiState,
  debounceMs: number
): void => {
  /** Composite target ID shared with the revision collection. */
  const id = createAccordionUiStateKey(uiState.workspaceId, uiState.persistenceId)
  mutatePacedRendererDomainMutation({
    mutation: { command: uiState, plan: planSetAccordionUiStateDomainMutation },
    ipc: { channel: 'set-accordion-ui-state' },
    renderer: {},
    pacing: {
      target: { entityType: 'accordionUiState', id },
      debounceMs
    }
  })
}

/** Queues one category-description editor UI-state upsert or optional delete. */
export const setCategoryDescriptionEditorUiStateWithAutosave = (
  command: SetCategoryDescriptionEditorUiStateDomainCommand,
  debounceMs: number
): void => {
  /** Composite target ID shared with the revision collection. */
  const id = createCategoryDescriptionEditorUiStateKey(
    command.workspaceId,
    command.categoryId
  )
  mutatePacedRendererDomainMutation({
    mutation: { command, plan: planSetCategoryDescriptionEditorUiStateDomainMutation },
    ipc: { channel: 'set-category-description-editor-ui-state' },
    renderer: {},
    pacing: {
      target: { entityType: 'categoryDescriptionEditorUiState', id },
      debounceMs
    }
  })
}

/** Immediately synchronizes the workspace screen selection and last-root pointer. */
export const syncWorkspaceScreenSelection = async (
  workspaceId: string,
  workspaceScreenSelection: WorkspaceScreenSelection
): Promise<void> => {
  /** Current workspace UI state loaded before workspace navigation becomes available. */
  const current = workspaceUiStateCollection.get(workspaceId)
  if (!current) throw new Error('Workspace UI state not loaded')
  /** Last root updated only when the prompt-folder screen selects a concrete root. */
  const lastPromptFolderId =
    workspaceScreenSelection.selectedScreen === 'prompt-folders'
      ? workspaceScreenSelection.selectedScreenData.promptFolderId
      : current.lastPromptFolderId
  /** Complete desired workspace-level state persisted through one domain command. */
  const command: WorkspaceUiState = {
    workspaceId,
    ...workspaceScreenSelection,
    lastPromptFolderId
  }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planSetWorkspaceUiStateDomainMutation },
    ipc: { channel: 'set-workspace-ui-state' },
    renderer: {}
  })
}

/** Public category-editor UI-state record type retained for autosave callers. */
export type { CategoryDescriptionEditorUiState }
