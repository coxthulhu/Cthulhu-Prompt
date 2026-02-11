let selectedWorkspaceId = $state<string | null>(null)

export const getSelectedWorkspaceId = (): string | null => {
  return selectedWorkspaceId
}

export const setSelectedWorkspaceId = (workspaceId: string | null): void => {
  selectedWorkspaceId = workspaceId
}
