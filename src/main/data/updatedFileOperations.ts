import { FileOperationQueue } from '../file-operation-queue'

const updatedFileQueue = new FileOperationQueue()

export const runExclusiveUpdatedWorkspaceOperation = async <T>(
  workspacePath: string,
  task: () => Promise<T>
): Promise<T> => {
  return await updatedFileQueue.run(workspacePath, task)
}
