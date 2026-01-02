import { describe, it, expect, vi } from 'vitest'
import { FileOperationQueue } from '../../src/main/file-operation-queue'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('FileOperationQueue', () => {
  it('serializes tasks for the same key', async () => {
    const queue = new FileOperationQueue()
    const order: string[] = []

    const first = queue.run('fileA', async () => {
      order.push('start-1')
      await delay(5)
      order.push('end-1')
    })

    const second = queue.run('fileA', async () => {
      order.push('start-2')
      await delay(1)
      order.push('end-2')
    })

    await Promise.all([first, second])

    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
  })

  it('allows tasks for different keys to run in parallel', async () => {
    const queue = new FileOperationQueue()
    let otherStarted = false

    const first = queue.run('fileA', async () => {
      await delay(5)
      expect(otherStarted).toBe(true)
    })

    const second = queue.run('fileB', async () => {
      otherStarted = true
    })

    await Promise.all([first, second])
  })

  it('continues processing after a failure', async () => {
    const queue = new FileOperationQueue()
    const spy = vi.fn()

    await expect(
      queue.run('fileA', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    await queue.run('fileA', async () => {
      spy()
    })

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
