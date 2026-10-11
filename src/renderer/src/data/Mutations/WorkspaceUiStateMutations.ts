import type { WorkspaceScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import {
  createAccordionUiStateKey,
  createWorkspacePromptCollectionUiStateKey,
  type AccordionUiState,
  type WorkspacePromptCollectionUiState,
  type WorkspaceUiState
} from '@shared/domain/ui-state/UiState'
import {
  planSetAccordionUiStateDomainMutation,
  planSetWorkspacePromptCollectionUiStateDomainMutation,
  planSetWorkspaceUiStateDomainMutation
} from '@shared/domain/ui-state/UiStateDomainMutations'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '@renderer/data/IpcFramework/RendererDomainMutation'

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

/** Queues one complete prompt-collection view UI-state replacement. */
export const setWorkspacePromptCollectionUiStateWithAutosave = (
  uiState: WorkspacePromptCollectionUiState,
  debounceMs: number
): void => {
  /** Composite target ID shared with the revision collection. */
  const id = createWorkspacePromptCollectionUiStateKey(
    uiState.workspaceId,
    uiState.contentOwnerId
  )
  mutatePacedRendererDomainMutation({
    mutation: { command: uiState, plan: planSetWorkspacePromptCollectionUiStateDomainMutation },
    ipc: { channel: 'set-workspace-prompt-collection-ui-state' },
    renderer: {},
    pacing: {
      target: { entityType: 'workspacePromptCollectionUiState', id },
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

/** Immediately synchronizes the workspace screen selection and last-collection pointer. */
export const syncWorkspaceScreenSelection = async (
  workspaceId: string,
  workspaceScreenSelection: WorkspaceScreenSelection
): Promise<void> => {
  /** Current workspace UI state loaded before workspace navigation becomes available. */
  const current = workspaceUiStateCollection.get(workspaceId)
  if (!current) throw new Error('Workspace UI state not loaded')
  /** Complete desired workspace-level state persisted through one domain command. */
  const command: WorkspaceUiState = {
    workspaceId,
    ...workspaceScreenSelection,
    lastPromptTaskCollectionId:
      workspaceScreenSelection.selectedScreen === 'prompt-task-collections'
        ? workspaceScreenSelection.selectedScreenData.promptCollectionId
        : current.lastPromptTaskCollectionId,
    lastPromptTemplateCollectionId:
      workspaceScreenSelection.selectedScreen === 'prompt-template-collections'
        ? workspaceScreenSelection.selectedScreenData.promptCollectionId
        : current.lastPromptTemplateCollectionId
  }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planSetWorkspaceUiStateDomainMutation },
    ipc: { channel: 'set-workspace-ui-state' },
    renderer: {}
  })
}
