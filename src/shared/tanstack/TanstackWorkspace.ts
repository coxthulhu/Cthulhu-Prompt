export interface TanstackWorkspaceData {
  workspacePath: string
  promptFolderIds: string[]
}

export type TanstackWorkspaceRecord = TanstackWorkspaceData & {
  id: string
}
