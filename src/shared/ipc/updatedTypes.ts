// Updated system settings (duplicated from legacy types).
export interface UpdatedSystemSettings {
  promptFontSize: number
  promptEditorMinLines: number
}

// Updated mutation/load helpers.
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

export type UpdatedLoadResult<TSuccess> =
  | ({ success: true } & TSuccess)
  | { success: false; error: string }

// Updated data models.
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

export interface UpdatedPromptData {
  title: string
  creationDate: string
  lastModifiedDate: string
  promptText: string
  promptFolderCount: number
}

// Updated IPC request/response types.
export type UpdatedLoadWorkspaceByIdRequest = ReadRequestData

export interface UpdatedLoadWorkspaceByPathRequest {
  workspacePath: string
}

export type UpdatedLoadWorkspaceByIdResult = UpdatedLoadResult<
  ResponseData<UpdatedWorkspaceData>
>

export type UpdatedLoadWorkspaceByPathResult = UpdatedLoadResult<{
  workspace: ResponseData<UpdatedWorkspaceData>
  promptFolders: Array<ResponseData<UpdatedPromptFolderData>>
}>

export type UpdatedLoadPromptFolderByIdRequest = ReadRequestData

export type UpdatedLoadPromptFolderByIdResult = UpdatedLoadResult<
  ResponseData<UpdatedPromptFolderData>
>

export type UpdatedLoadPromptFolderInitialRequest = ReadRequestData

export type UpdatedLoadPromptFolderInitialResult = UpdatedLoadResult<{
  promptFolder: ResponseData<UpdatedPromptFolderData>
  prompts: Array<ResponseData<UpdatedPromptData>>
}>

export type UpdatedLoadPromptByIdRequest = ReadRequestData

export type UpdatedLoadPromptByIdResult = UpdatedLoadResult<ResponseData<UpdatedPromptData>>
