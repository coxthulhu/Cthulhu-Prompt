type SerialTask<T> = () => Promise<T>

const createSerialQueue = () => {
  let queue: Promise<void> = Promise.resolve()

  return <T>(task: SerialTask<T>): Promise<T> => {
    const run = queue.then(task)
    queue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}

// Global queue to serialize IPC traffic for the updated data layer.
export const enqueueGlobalMessage = createSerialQueue()
