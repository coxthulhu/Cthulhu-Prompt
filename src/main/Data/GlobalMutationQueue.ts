let mutationQueueTail: Promise<void> = Promise.resolve()

export const enqueueGlobalMutation = async <TResult>(
  mutation: () => Promise<TResult>
): Promise<TResult> => {
  const mutationTask = mutationQueueTail.then(async () => {
    return await mutation()
  })

  mutationQueueTail = mutationTask.then(
    () => undefined,
    () => undefined
  )

  return await mutationTask
}
