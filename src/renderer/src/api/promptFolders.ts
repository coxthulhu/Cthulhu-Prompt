import type { LoadPromptFoldersResult, PromptFolder, PromptFolderResult } from '@shared/ipc'

import { makeIpcMutation } from './makeIpcMutation'
import { makeIpcQuery } from './makeIpcQuery'
import { mutationKeys, queryKeys } from './queryKeys'

type CreatePromptFolderInput = {
  workspacePath: string
  displayName: string
}

const promptFoldersQuery = makeIpcQuery<LoadPromptFoldersResult, string | null, PromptFolder[]>({
  key: (workspacePath) => queryKeys.promptFolders.list(workspacePath),
  channel: 'load-prompt-folders',
  select: (result) => result.folders ?? []
})

export function usePromptFoldersQuery(payload: string | null | typeof skipToken) {
  return promptFoldersQuery(payload)
}

export function useCreatePromptFolderMutation() {
  return makeIpcMutation<CreatePromptFolderInput, PromptFolderResult>({
    channel: 'create-prompt-folder',
    invalidate: (_result, input) => [queryKeys.promptFolders.list(input.workspacePath)]
  })
}

export type { CreatePromptFolderInput }
export const promptFolderMutationKeys = mutationKeys.promptFolders
import { skipToken } from '@tanstack/svelte-query'
