import { enqueueUpdatedGlobalMessage } from './UpdatedGlobalQueue'

// Thin wrapper so mutations share the same global message queue.
export const enqueueUpdatedMutation = <T>(task: () => Promise<T>): Promise<T> =>
  enqueueUpdatedGlobalMessage(task)
