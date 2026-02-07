// Field names intentionally match UpdatedWorkspaceData during migration.
export interface TanstackWorkspace {
  id: string
  workspacePath: string
  promptFolderIds: string[]
}
