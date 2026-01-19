import type { CreateWorkspaceRequest, WorkspaceResult } from '@shared/ipc'

import { makeIpcMutation } from './makeIpcMutation'
import { mutationKeys } from './queryKeys'

export type OpenSelectWorkspaceFolderDialogResult = {
  dialogCancelled: boolean
  filePaths: string[]
}

type CreateWorkspaceInput = CreateWorkspaceRequest

type CheckWorkspaceFolderExistsInput = string

export function useOpenSelectWorkspaceFolderDialogMutation() {
  return makeIpcMutation<void, OpenSelectWorkspaceFolderDialogResult>({
    channel: 'select-workspace-folder'
  })
}

export function useCheckWorkspaceFolderExistsMutation() {
  return makeIpcMutation<CheckWorkspaceFolderExistsInput, boolean>({
    channel: 'check-folder-exists'
  })
}

export function useCreateWorkspaceMutation() {
  return makeIpcMutation<CreateWorkspaceInput, WorkspaceResult>({
    channel: 'create-workspace'
  })
}

export const workspaceMutationKeys = mutationKeys.workspace
