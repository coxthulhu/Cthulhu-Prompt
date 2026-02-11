import { getContext, setContext } from 'svelte'

const WORKSPACE_SELECTION_CONTEXT = Symbol('workspace-selection')

export type WorkspaceSelectionContext = {
  selectedWorkspaceId: string | null
}

export const setWorkspaceSelectionContext = (
  value: WorkspaceSelectionContext
): void => {
  setContext(WORKSPACE_SELECTION_CONTEXT, value)
}

export const getWorkspaceSelectionContext = (): WorkspaceSelectionContext => {
  return getContext<WorkspaceSelectionContext>(WORKSPACE_SELECTION_CONTEXT)
}
