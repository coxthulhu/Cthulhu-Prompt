// Base IPC results/requests.
export interface WorkspaceResult {
  success: boolean
  error?: string
}

export interface CreateWorkspaceRequest {
  workspacePath: string
  includeExamplePrompts: boolean
}

export type RevisionDataResult<TData> =
  | { success: true; data: TData; revision: number }
  | { success: false; conflict: true; data: TData; revision: number }
  | { success: false; error: string; conflict?: false }

export type LoadResult<TSuccess> =
  | ({ success: true } & TSuccess)
  | { success: false; error: string }

// Legacy prompt folder types.
export interface PromptFolder {
  folderName: string
  displayName: string
}

export interface PromptFolderResult extends WorkspaceResult {
  folder?: PromptFolder
}

export interface LoadPromptFoldersResult extends WorkspaceResult {
  folders?: PromptFolder[]
}

// Legacy workspace types.
export interface WorkspaceFolderDraft {
  displayName: string
}

export interface WorkspaceData {
  workspaceId: string
  workspacePath: string
  folders: PromptFolder[]
}

export interface LoadWorkspaceDataRequest {
  workspacePath: string
}

export type LoadWorkspaceDataSuccess = { workspace: WorkspaceData; revision: number }

export type LoadWorkspaceDataResult = LoadResult<LoadWorkspaceDataSuccess>

export interface UpdateWorkspaceDataRequest {
  workspacePath: string
  folders: WorkspaceFolderDraft[]
  revision: number
}

export type UpdateWorkspaceDataResult = RevisionDataResult<WorkspaceData>

// Legacy prompt types.
export interface Prompt {
  id: string
  title: string
  creationDate: string
  lastModifiedDate: string
  promptText: string
  promptFolderCount: number
}

export interface PromptResult extends WorkspaceResult {
  prompt?: Prompt
}

export interface LoadPromptsResult extends WorkspaceResult {
  prompts?: Prompt[]
  folderDescription?: string
}
