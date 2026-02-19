import { app, ipcMain } from 'electron'
import { startupNormally } from '../NormalStartup'
import { getFs, setFs } from '../fs-provider'
import { setDialogProvider, createTestDialogProvider } from '../dialog-provider'
import { isPlaywrightEnvironment } from '../appEnvironment'

interface TestFixtures {
  fileDialogResults?: string[]
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

type FilesystemSetupPayload = {
  filesystem: Record<string, string | null>
  requestId: string
}

type FilesystemSetupResult = {
  success: boolean
  error?: string
}

function emitFilesystemSetupResult(requestId: string, result: FilesystemSetupResult): void {
  ;(app as any).emit(`test-setup-filesystem-ready:${requestId}`, result)
}

function parseFilesystemSetupPayload(payload: unknown): FilesystemSetupPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>

  if (typeof record.requestId !== 'string') {
    return null
  }

  if (!record.filesystem || typeof record.filesystem !== 'object') {
    return null
  }

  return {
    requestId: record.requestId,
    filesystem: record.filesystem as Record<string, string | null>
  }
}

export function setupTestStartupListener(): void {
  initializeIpcGatingForE2E()
  ;(app as any).on('test-setup-filesystem', async (payload: unknown) => {
    const typedPayload = parseFilesystemSetupPayload(payload)

    if (!typedPayload) {
      const requestId =
        payload &&
        typeof payload === 'object' &&
        'requestId' in (payload as Record<string, unknown>)
          ? String((payload as Record<string, unknown>).requestId ?? '')
          : ''

      if (requestId) {
        emitFilesystemSetupResult(requestId, {
          success: false,
          error: 'No filesystem payload provided'
        })
      }

      return
    }

    try {
      const { vol } = await import('memfs')
      vol.reset()
      vol.fromJSON(typedPayload.filesystem)
      setFs(vol)
      emitFilesystemSetupResult(typedPayload.requestId, { success: true })
    } catch (error) {
      console.error('Failed to set up mocked filesystem:', error)
      const message = error instanceof Error ? error.message : String(error)
      emitFilesystemSetupResult(typedPayload.requestId, {
        success: false,
        error: message
      })
    }
  })
  ;(app as any).on('test-setup-file-dialog', (results: string[]) => {
    testFixtures.fileDialogResults = results
  })
  ;(app as any).on('test-check-file-exists', (filePath: string) => {
    const fs = getFs()
    const exists = fs.existsSync(filePath)
    ;(global as any).testFileExistsResult = exists
  })
  ;(app as any).on('test-read-file', (payload: { filePath: string; requestId: string }) => {
    const fs = getFs()
    const content = fs.readFileSync(payload.filePath, 'utf8')
    ;(app as any).emit(`test-read-file-ready:${payload.requestId}`, { content })
  })
  ;(app as any).on('test-complete-startup', () => {
    if (testFixtures.fileDialogResults) {
      setDialogProvider(createTestDialogProvider(testFixtures.fileDialogResults))
    }

    ;(app as any)._testStartupCompleted = true
    startupNormally()
  })
}
