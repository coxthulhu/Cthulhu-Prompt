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

export type UpdatedMutationResult<TData> =
  | { success: true; data: TData }
  | { success: false; conflict: true; data: TData }
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

export interface UpdatedWorkspaceData {
  workspaceId: string
  workspacePath: string
  promptFolderIds: string[]
}

export interface UpdatedPromptFolderData {
  promptFolderId: string
  folderName: string
  displayName: string
  promptCount: number
  promptIds: string[]
  folderDescription: string
}

export interface LoadWorkspaceDataRequest {
  workspacePath: string
}

export type LoadWorkspaceDataSuccess = { workspace: WorkspaceData; revision: number }

export type LoadWorkspaceDataResult = LoadResult<LoadWorkspaceDataSuccess>

export interface UpdatedLoadWorkspaceByIdRequest {
  workspaceId: string
}

export type UpdatedLoadWorkspaceByIdResult = LoadResult<{
  data: UpdatedWorkspaceData
  revision: number
}>

export interface UpdatedLoadWorkspaceByPathRequest {
  workspacePath: string
}

export type UpdatedLoadWorkspaceByPathResult = LoadResult<{
  workspace: UpdatedWorkspaceData
  workspaceRevision: number
  promptFolders: Array<{ data: UpdatedPromptFolderData; revision: number }>
}>

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

export interface UpdatedLoadPromptFolderByIdRequest {
  promptFolderId: string
}

export type UpdatedLoadPromptFolderByIdResult = LoadResult<{
  data: UpdatedPromptFolderData
  revision: number
}>

export interface UpdatedLoadPromptFolderInitialRequest {
  promptFolderId: string
}

export type UpdatedLoadPromptFolderInitialResult = LoadResult<{
  promptFolder: { data: UpdatedPromptFolderData; revision: number }
  prompts: Array<{ data: Prompt; revision: number }>
}>

export interface UpdatedLoadPromptByIdRequest {
  promptId: string
}

export type UpdatedLoadPromptByIdResult = LoadResult<{
  data: Prompt
  revision: number
}>

export interface PromptResult extends WorkspaceResult {
  prompt?: Prompt
}

export interface LoadPromptsResult extends WorkspaceResult {
  prompts?: Prompt[]
  folderDescription?: string
}
