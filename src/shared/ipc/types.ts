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
}

export interface UpdateSystemSettingsRequest {
  settings: Partial<SystemSettings>
}

export interface UpdateSystemSettingsResult extends WorkspaceResult {
  settings?: SystemSettings
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
}
