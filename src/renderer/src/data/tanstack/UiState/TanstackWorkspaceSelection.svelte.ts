let tanstackSelectedWorkspaceId = $state<string | null>(null)

export const getTanstackSelectedWorkspaceId = (): string | null => {
  return tanstackSelectedWorkspaceId
}

export const setTanstackSelectedWorkspaceId = (workspaceId: string | null): void => {
  tanstackSelectedWorkspaceId = workspaceId
}
