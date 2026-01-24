import type {
  LoadPromptFoldersResult,
  PromptFolder,
  PromptFolderResult
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

type CreatePromptFolderInput = {
  workspacePath: string
  displayName: string
}

export type PromptFolderListState = {
  folders: PromptFolder[]
  isLoading: boolean
  errorMessage: string | null
  workspacePath: string | null
  requestId: number
}

const promptFolderListState = $state<PromptFolderListState>({
  folders: [],
  isLoading: false,
  errorMessage: null,
  workspacePath: null,
  requestId: 0
})

let nextRequestId = 0

const isLatestRequest = (workspacePath: string, requestId: number): boolean => {
  return (
    promptFolderListState.workspacePath === workspacePath &&
    promptFolderListState.requestId === requestId
  )
}

export const getPromptFolderListState = (): PromptFolderListState => promptFolderListState

export const resetPromptFolderListStoreForWorkspace = (workspacePath: string | null): void => {
  promptFolderListState.workspacePath = workspacePath
  promptFolderListState.folders = []
  promptFolderListState.errorMessage = null
  promptFolderListState.requestId = 0
  promptFolderListState.isLoading = Boolean(workspacePath)
}

export const loadPromptFolderList = async (workspacePath: string): Promise<void> => {
  const requestId = (nextRequestId += 1)

  promptFolderListState.workspacePath = workspacePath
  promptFolderListState.requestId = requestId
  promptFolderListState.isLoading = true
  promptFolderListState.errorMessage = null

  try {
    const result = await ipcInvoke<LoadPromptFoldersResult, string>(
      'load-prompt-folders',
      workspacePath
    )

    if (!isLatestRequest(workspacePath, requestId)) return

    promptFolderListState.folders = result.folders ?? []
    promptFolderListState.isLoading = false
  } catch (error) {
    if (!isLatestRequest(workspacePath, requestId)) return

    promptFolderListState.errorMessage = error instanceof Error ? error.message : String(error)
    promptFolderListState.isLoading = false
  }
}

export const createPromptFolder = async (
  input: CreatePromptFolderInput
): Promise<PromptFolderResult> => {
  const result = await ipcInvoke<PromptFolderResult, CreatePromptFolderInput>(
    'create-prompt-folder',
    input
  )

  if (input.workspacePath) {
    await loadPromptFolderList(input.workspacePath)
  }

  return result
}
