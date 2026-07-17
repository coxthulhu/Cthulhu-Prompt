export type ConsumableRequest<T> = Readonly<{
  id: number
  payload: T
}>

export type ConsumableRequestCoordinator<T> = {
  readonly pending: ConsumableRequest<T> | null
  request: (payload: T) => ConsumableRequest<T>
  consume: (request: ConsumableRequest<T>, perform: (payload: T) => void) => boolean
  cancel: (request: ConsumableRequest<T>) => void
  clear: () => void
}

export const createConsumableRequestCoordinator = <T>(): ConsumableRequestCoordinator<T> => {
  let nextId = 0
  let pending = $state.raw<ConsumableRequest<T> | null>(null)
  let leasedId: number | null = null

  const request = (payload: T): ConsumableRequest<T> => {
    // A new generation synchronously supersedes any unconsumed request in this domain.
    pending = {
      id: (nextId += 1),
      payload
    }
    return pending
  }

  const consume = (
    expected: ConsumableRequest<T>,
    perform: (payload: T) => void
  ): boolean => {
    if (pending?.id !== expected.id || leasedId !== null) return false

    // Lease before the final action so only one mounted consumer can acknowledge it.
    leasedId = expected.id
    try {
      perform(expected.payload)
      if (pending?.id === expected.id) pending = null
      return true
    } finally {
      if (leasedId === expected.id) leasedId = null
    }
  }

  const cancel = (expected: ConsumableRequest<T>): void => {
    if (pending?.id !== expected.id) return
    pending = null
    if (leasedId === expected.id) leasedId = null
  }

  const clear = (): void => {
    pending = null
    leasedId = null
  }

  return {
    get pending() {
      return pending
    },
    request,
    consume,
    cancel,
    clear
  }
}
