import { enqueueUpdatedGlobalMessage } from './UpdatedGlobalQueue'

// Thin wrapper so loads share the same global message queue.
export const enqueueUpdatedLoad = <T>(task: () => Promise<T>): Promise<T> =>
  enqueueUpdatedGlobalMessage(task)
