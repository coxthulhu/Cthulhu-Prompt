export interface WorkspaceResult {
  success: boolean
  error?: string
}

export interface CreateWorkspaceRequest {
  workspacePath: string
  includeExamplePrompts: boolean
}

export interface SystemSettings {
  promptFontSize: number
  promptEditorMinLines: number
}

export interface LoadSystemSettingsResult extends WorkspaceResult {
  settings?: SystemSettings
  revision?: number
}

export interface UpdateSystemSettingsRequest {
  settings: SystemSettings
  revision: number
}

export type RevisionDataResult<TData> =
  | { success: true; data: TData; revision: number }
  | { success: false; conflict: true; data: TData; revision: number }
  | { success: false; error: string; conflict?: false }

export type LoadResult<TSuccess> =
  | ({ success: true } & TSuccess)
  | { success: false; error: string }

export type UpdateSystemSettingsResult = RevisionDataResult<SystemSettings>

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
