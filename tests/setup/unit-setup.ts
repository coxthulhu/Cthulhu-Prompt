import { vi } from 'vitest'
import { vol } from 'memfs'

// Mock filesystem with memfs
vi.mock('fs', async () => {
  const memfs = await vi.importActual('memfs')
  return memfs.fs
})

vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual('memfs')
  return memfs.fs.promises
})

// Reset filesystem before each test
beforeEach(() => {
  vol.reset()
})
