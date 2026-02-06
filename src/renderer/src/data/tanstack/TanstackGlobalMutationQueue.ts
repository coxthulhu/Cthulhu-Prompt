type TanstackQueuedTask<T> = () => Promise<T>

let queue: Promise<void> = Promise.resolve()

export const enqueueTanstackGlobalMutation = <T>(task: TanstackQueuedTask<T>): Promise<T> => {
  const run = queue.then(task)
  queue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}
