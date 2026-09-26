import { dialog } from 'electron'
import { vol } from 'memfs'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDialogProvider } from '../../src/main/dialog-provider'
import { setFs } from '../../src/main/fs-provider'
import { UserPersistenceDataAccess } from '../../src/main/Persistence/sqlite/UserPersistenceDataAccess'
import { DEFAULT_USER_PERSISTENCE } from '../../src/shared/domain/user-persistence/UserPersistence'

vi.mock('electron', () => ({
  app: { getPath: (name: string) => `/dialog-test/${name}` },
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('../../src/main/Persistence/sqlite/UserPersistenceDataAccess', () => ({
  UserPersistenceDataAccess: {
    readUserPersistence: vi.fn(),
    readWorkspaceDialogDirectory: vi.fn(),
    updateWorkspaceDialogDirectory: vi.fn()
  }
}))

const selectedFile = '/workspaces/selected/Selected.cthulhuprompt.json'
const previousFile = '/workspaces/previous/Previous.cthulhuprompt.json'

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(UserPersistenceDataAccess.readWorkspaceDialogDirectory).mockReturnValue(null)
  setFs(vol)
  vol.mkdirSync('/workspaces/selected', { recursive: true })
  vol.mkdirSync('/workspaces/previous', { recursive: true })
  vi.mocked(UserPersistenceDataAccess.readUserPersistence).mockReturnValue({
    ...DEFAULT_USER_PERSISTENCE,
    lastWorkspaceInfoPath: previousFile
  })
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] })
})

describe('workspace Open dialog directory', () => {
  it('starts existing users in the last workspace directory', async () => {
    await getDialogProvider().selectWorkspaceInfoFile()

    expect(dialog.showOpenDialog).toHaveBeenCalledWith({
      defaultPath: path.dirname(previousFile),
      properties: ['openFile'],
      filters: [{ name: 'Cthulhu Prompt Workspace', extensions: ['cthulhuprompt.json'] }]
    })
  })

  it('writes the selected directory and restores it independently of the workspace', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [selectedFile]
    })
    expect(await getDialogProvider().selectWorkspaceInfoFile()).toEqual({
      dialogCancelled: false,
      filePaths: [selectedFile]
    })
    expect(UserPersistenceDataAccess.updateWorkspaceDialogDirectory).toHaveBeenCalledWith(
      path.dirname(selectedFile)
    )
    vi.mocked(UserPersistenceDataAccess.readWorkspaceDialogDirectory).mockReturnValue(
      path.dirname(selectedFile)
    )

    vi.mocked(UserPersistenceDataAccess.readUserPersistence).mockReturnValue({
      ...DEFAULT_USER_PERSISTENCE
    })
    vi.resetModules()
    const restartedProvider = await import('../../src/main/dialog-provider')
    await restartedProvider.getDialogProvider().selectWorkspaceInfoFile()
    expect(dialog.showOpenDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultPath: path.dirname(selectedFile) })
    )
  })

  it.each([
    { canceled: true, filePaths: [previousFile] },
    { canceled: false, filePaths: [] }
  ])('keeps the preference when no file is selected: %j', async (result) => {
    vi.mocked(UserPersistenceDataAccess.readWorkspaceDialogDirectory).mockReturnValue(
      path.dirname(selectedFile)
    )
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce(result)
    await getDialogProvider().selectWorkspaceInfoFile()
    expect(UserPersistenceDataAccess.updateWorkspaceDialogDirectory).not.toHaveBeenCalled()
  })

  it.each([
    null,
    '/deleted-workspace',
    'relative-directory',
    '/workspaces/not-a-directory'
  ])('falls back to the workspace for an unusable preference: %s', async (saved) => {
    vol.writeFileSync('/workspaces/not-a-directory', 'file')
    vi.mocked(UserPersistenceDataAccess.readWorkspaceDialogDirectory).mockReturnValue(saved)
    await getDialogProvider().selectWorkspaceInfoFile()
    expect(dialog.showOpenDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultPath: path.dirname(previousFile) })
    )
  })

  it.each([null, '/deleted-workspace/Workspace.cthulhuprompt.json'])(
    'uses Downloads when neither directory is available: %s',
    async (lastWorkspaceInfoPath) => {
      vi.mocked(UserPersistenceDataAccess.readUserPersistence).mockReturnValue({
        ...DEFAULT_USER_PERSISTENCE,
        lastWorkspaceInfoPath
      })
      await getDialogProvider().selectWorkspaceInfoFile()
      expect(dialog.showOpenDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({ defaultPath: '/dialog-test/downloads' })
      )
    }
  )

  it('still returns the selected file when saving the preference fails', async () => {
    vi.mocked(UserPersistenceDataAccess.updateWorkspaceDialogDirectory).mockImplementation(() => {
      throw new Error('Database write failed')
    })
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [selectedFile]
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(await getDialogProvider().selectWorkspaceInfoFile()).toEqual({
        dialogCancelled: false,
        filePaths: [selectedFile]
      })
      expect(warning).toHaveBeenCalled()
    } finally {
      warning.mockRestore()
    }
  })
})
