import { createMutation, type MutationKey } from '@tanstack/svelte-query'

import { ipcInvoke } from './ipcInvoke'
import { queryClient } from './queryClient'

type MakeIpcMutationOptions<TInput, TOutput> = {
  channel: string
  invalidate?: MutationKey[] | ((result: TOutput, input: TInput) => MutationKey[])
}

export function makeIpcMutation<TInput, TOutput>(opts: MakeIpcMutationOptions<TInput, TOutput>) {
  const { channel, invalidate } = opts

  return createMutation(() => ({
    mutationFn: (input: TInput) => ipcInvoke<TOutput, TInput>(channel, input),
    onSuccess: async (result, input) => {
      const keys = typeof invalidate === 'function' ? invalidate(result, input) : invalidate

      if (!keys?.length) return

      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    }
  }))
}
