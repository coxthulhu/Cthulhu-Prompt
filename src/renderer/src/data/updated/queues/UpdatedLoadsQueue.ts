import { enqueueGlobalMessage } from './UpdatedGlobalQueue'

// Thin wrapper so loads share the same global message queue.
export const enqueueLoad = <T>(task: () => Promise<T>): Promise<T> => enqueueGlobalMessage(task)
