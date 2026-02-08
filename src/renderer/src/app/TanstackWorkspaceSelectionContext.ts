import { getContext, setContext } from 'svelte'

const TANSTACK_WORKSPACE_SELECTION_CONTEXT = Symbol('tanstack-workspace-selection')

export type TanstackWorkspaceSelectionContext = {
  selectedWorkspaceId: string | null
}

export const setTanstackWorkspaceSelectionContext = (
  value: TanstackWorkspaceSelectionContext
): void => {
  setContext(TANSTACK_WORKSPACE_SELECTION_CONTEXT, value)
}

export const getTanstackWorkspaceSelectionContext = (): TanstackWorkspaceSelectionContext => {
  return getContext<TanstackWorkspaceSelectionContext>(TANSTACK_WORKSPACE_SELECTION_CONTEXT)
}
