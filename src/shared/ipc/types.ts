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

export interface UpdateSystemSettingsResult extends WorkspaceResult {
  data?: SystemSettings
  version?: number
  conflict?: boolean
}

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

export interface LoadWorkspaceDataResult extends WorkspaceResult {
  workspace?: WorkspaceData
  version?: number
}

export interface UpdateWorkspaceDataRequest {
  workspacePath: string
  folders: WorkspaceFolderDraft[]
  version: number
}

export interface UpdateWorkspaceDataResult extends WorkspaceResult {
  data?: WorkspaceData
  version?: number
  conflict?: boolean
}

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
