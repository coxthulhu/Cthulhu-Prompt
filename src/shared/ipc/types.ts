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

// Mutation IPC wrappers for request/response payloads.
export type UpdatedMutationRequest<TPayload> = {
  requestId: string
  payload: TPayload
}

export type MutationRequestData<TData> = {
  data: TData
  expectedRevision: number | null
}

export type ReadRequestData<TData = undefined> = {
  id: string
  data?: TData
}

export type ResponseData<TData> = {
  data: TData
  revision: number
  id: string
  clientTempId?: string
}

export type UpdatedMutationResult<TPayload> =
  | { requestId: string; success: true; payload: TPayload }
  | { requestId: string; success: false; conflict: true; payload: TPayload }
  | { requestId: string; success: false; error: string; conflict?: false }

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
  workspacePath: string
  promptFolderIds: string[]
}

export interface UpdatedPromptFolderData {
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

export type UpdatedLoadWorkspaceByIdRequest = ReadRequestData

export type UpdatedLoadWorkspaceByIdResult = LoadResult<
  ResponseData<UpdatedWorkspaceData>
>

export interface UpdatedLoadWorkspaceByPathRequest {
  workspacePath: string
}

export type UpdatedLoadWorkspaceByPathResult = LoadResult<{
  workspace: ResponseData<UpdatedWorkspaceData>
  promptFolders: Array<ResponseData<UpdatedPromptFolderData>>
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

export interface UpdatedPromptData {
  title: string
  creationDate: string
  lastModifiedDate: string
  promptText: string
  promptFolderCount: number
}

export type UpdatedLoadPromptFolderByIdRequest = ReadRequestData

export type UpdatedLoadPromptFolderByIdResult = LoadResult<
  ResponseData<UpdatedPromptFolderData>
>

export type UpdatedLoadPromptFolderInitialRequest = ReadRequestData

export type UpdatedLoadPromptFolderInitialResult = LoadResult<{
  promptFolder: ResponseData<UpdatedPromptFolderData>
  prompts: Array<ResponseData<UpdatedPromptData>>
}>

export type UpdatedLoadPromptByIdRequest = ReadRequestData

export type UpdatedLoadPromptByIdResult = LoadResult<ResponseData<UpdatedPromptData>>

export interface PromptResult extends WorkspaceResult {
  prompt?: Prompt
}

export interface LoadPromptsResult extends WorkspaceResult {
  prompts?: Prompt[]
  folderDescription?: string
}
