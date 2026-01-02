type Task<T> = () => Promise<T>

/**
 * Simple per-key async queue that ensures tasks for the same key
 * run sequentially while allowing other keys to progress in parallel.
 */
export class FileOperationQueue {
  private readonly tails = new Map<string, Promise<void>>()

  async run<T>(key: string, task: Task<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()

    // Chain after previous task regardless of whether it failed.
    const start = previous.catch(() => {
      /* swallow to keep queue alive */
    })

    const runPromise = start.then(task)
    const tail = runPromise
      .then(() => {
        /* keep tail resolved */
      })
      .catch(() => {
        /* swallow errors for the next item */
      })

    this.tails.set(key, tail)

    try {
      return await runPromise
    } finally {
      if (this.tails.get(key) === tail) {
        this.tails.delete(key)
      }
    }
  }
}
