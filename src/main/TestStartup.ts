import { app, ipcMain } from 'electron'
import { startupNormally } from './NormalStartup'
import { getFs, setFs } from './fs-provider'
import { setDialogProvider, createTestDialogProvider } from './dialog-provider'
import { isPlaywrightEnvironment } from './appEnvironment'
import { setTanstackFs } from './tanstack/TanstackFsProvider'

// Test setup storage
interface TestFixtures {
  filesystem?: Record<string, string | null>
  fileDialogResults?: any[]
}

const testFixtures: TestFixtures = {}

type IpcGate = {
  wait: Promise<void>
  release: () => void
}

let ipcGatingInitialized = false

function shouldEnablePlaywrightSetup(): boolean {
  return isPlaywrightEnvironment()
}

function initializeIpcGatingForE2E(): void {
  if (ipcGatingInitialized || !shouldEnablePlaywrightSetup()) {
    return
  }

  ipcGatingInitialized = true

  const gates = new Map<string, IpcGate>()

  const ensureGate = (channel: string) => {
    if (!channel || gates.has(channel)) {
      return
    }

    let release!: () => void
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })

    gates.set(channel, { wait, release })
  }

  const releaseGate = (channel: string) => {
    const gate = gates.get(channel)
    if (!gate) {
      return
    }

    gate.release()
    gates.delete(channel)
  }

  ;(app as any).on('test-ipc-gate', (channel: unknown) => {
    if (typeof channel === 'string') {
      ensureGate(channel)
    }
  })
  ;(app as any).on('test-ipc-release', (channel: unknown) => {
    if (typeof channel === 'string') {
      releaseGate(channel)
    }
  })

  const realHandle = ipcMain.handle.bind(ipcMain)

  const wrappedHandle: typeof ipcMain.handle = (channel, listener) => {
    return realHandle(channel, async (event, ...args) => {
      const gate = gates.get(channel)
      if (gate) {
        await gate.wait
      }

      return listener(event, ...args)
    })
  }

  ipcMain.handle = wrappedHandle
}

type FilesystemSetupPayload =
  | Record<string, string | null>
  | {
      filesystem?: Record<string, string | null>
      requestId?: string | null
    }

type FilesystemSetupResult = {
  success: boolean
  error?: string
}

function emitFilesystemSetupResult(
  requestId: string | undefined,
  result: FilesystemSetupResult
): void {
  if (requestId) {
    ;(app as any).emit(`test-setup-filesystem-ready:${requestId}`, result)
  } else {
    ;(global as any).testFilesystemReady = result.success
  }
}

export function setupTestStartupListener(): void {
  initializeIpcGatingForE2E()

  // Listen for filesystem setup
  ;(app as any).on('test-setup-filesystem', async (payload: FilesystemSetupPayload) => {
    let filesystem: Record<string, string | null> | undefined
    let requestId: string | undefined

    if (payload && typeof payload === 'object' && 'filesystem' in payload) {
      const withId = payload as {
        filesystem?: Record<string, string | null>
        requestId?: string | null
      }
      filesystem = withId.filesystem
      requestId = typeof withId.requestId === 'string' ? withId.requestId : undefined
    } else if (payload && typeof payload === 'object') {
      filesystem = payload as Record<string, string | null>
    }

    if (!filesystem) {
      emitFilesystemSetupResult(requestId, {
        success: false,
        error: 'No filesystem payload provided'
      })
      return
    }

    testFixtures.filesystem = filesystem

    // Immediately set up the mocked filesystem
    try {
      const { vol } = await import('memfs')
      vol.reset()
      vol.fromJSON(filesystem)
      setFs(vol)
      setTanstackFs(vol)
      emitFilesystemSetupResult(requestId, { success: true })
    } catch (error) {
      console.error('Failed to set up mocked filesystem:', error)
      const message = error instanceof Error ? error.message : String(error)
      emitFilesystemSetupResult(requestId, { success: false, error: message })
    }
  })

  // Listen for file dialog setup
  ;(app as any).on('test-setup-file-dialog', (results: any[]) => {
    testFixtures.fileDialogResults = results
  })

  // Listen for file existence check
  ;(app as any).on('test-check-file-exists', (filePath: string) => {
    const fs = getFs()
    const exists = fs.existsSync(filePath)
    ;(global as any).testFileExistsResult = exists
  })

  // Listen for file read requests
  ;(app as any).on(
    'test-read-file',
    (payload: { filePath: string; requestId: string }) => {
      const fs = getFs()
      const content = fs.readFileSync(payload.filePath, 'utf8')
      ;(app as any).emit(`test-read-file-ready:${payload.requestId}`, { content })
    }
  )

  // Listen for startup completion
  ;(app as any).on('test-complete-startup', () => {
    // Apply filesystem setup if provided
    if (testFixtures.filesystem) {
      // Store filesystem data for NormalStartup to use
      ;(global as any).testFilesystemData = testFixtures.filesystem
    }

    // Apply file dialog setup if provided
    if (testFixtures.fileDialogResults) {
      // Set up dialog provider with test results
      setDialogProvider(createTestDialogProvider(testFixtures.fileDialogResults))
    }

    // Mark startup as completed and start normally
    ;(app as any)._testStartupCompleted = true
    startupNormally()
  })
}
