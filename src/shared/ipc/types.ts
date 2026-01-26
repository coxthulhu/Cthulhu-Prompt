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
}

export interface LoadSystemSettingsResult extends WorkspaceResult {
  settings?: SystemSettings
  version?: number
}

export interface UpdateSystemSettingsRequest {
  settings: SystemSettings
  version: number
}

export type VersionedDataResult<TData> =
  | { success: true; data: TData; version: number }
  | { success: false; conflict: true; data: TData; version: number }
  | { success: false; error: string; conflict?: false }

export type UpdateSystemSettingsResult = VersionedDataResult<SystemSettings>

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

export type LoadWorkspaceDataResult =
  | { success: true; workspace: WorkspaceData; version: number }
  | { success: false; error: string }

export interface UpdateWorkspaceDataRequest {
  workspacePath: string
  folders: WorkspaceFolderDraft[]
  version: number
}

export type UpdateWorkspaceDataResult = VersionedDataResult<WorkspaceData>

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
