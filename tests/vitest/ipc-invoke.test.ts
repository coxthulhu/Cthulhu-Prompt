import { afterEach, describe, expect, it, vi } from 'vitest'
import { ipcInvoke } from '@renderer/data/IpcFramework/IpcInvoke'

describe('IPC invoke logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('logs conflict request context without an undefined error field', async () => {
    const response = {
      success: false,
      conflict: true,
      requestId: 'request-1',
      clientId: 'client-1',
      payload: { promptFolders: [] }
    }
    const invoke = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('window', { electron: { ipcRenderer: { invoke } } })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(ipcInvoke('delete-prompt', { promptId: 'prompt-1' })).resolves.toBe(response)

    expect(warning).toHaveBeenCalledWith('IPC revision conflict', {
      channel: 'delete-prompt',
      requestId: 'request-1',
      clientId: 'client-1'
    })
    expect(warning.mock.calls[0]?.[1]).not.toHaveProperty('error')
  })
})
