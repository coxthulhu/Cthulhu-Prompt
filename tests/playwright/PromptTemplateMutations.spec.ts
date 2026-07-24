import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/template-mutations'
const WORKSPACE_ID = '000000000000000000000000b22e429b'
const SOURCE_FOLDER_ID = 'template-source'
const DESTINATION_FOLDER_ID = 'template-destination'

describe('Prompt template mutations', () => {
  test('creates, updates, moves, and deletes a template through IPC', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [
        {
          folderName: 'Source',
          displayName: 'Source',
          folderId: SOURCE_FOLDER_ID
        },
        {
          folderName: 'Destination',
          displayName: 'Destination',
          folderId: DESTINATION_FOLDER_ID
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()

    const invoke = async (channel: string, payload: object) =>
      await mainWindow.evaluate(
        async ({ ipcChannel, ipcPayload }) =>
          await window.electron.ipcRenderer.invoke(ipcChannel, {
            requestId: `test-template-${ipcChannel}-${Date.now()}-${Math.random()}`,
            clientId: window.ipcClientId,
            payload: ipcPayload
          }),
        { ipcChannel: channel, ipcPayload: payload }
      )
    const toPayloadEntity = (snapshot: { id: string; revision: number; data: unknown }) => ({
      id: snapshot.id,
      expectedRevision: snapshot.revision,
      data: snapshot.data
    })
    const loadFolder = async (promptFolderId: string) =>
      await invoke('load-prompt-folder-initial', {
        workspaceId: WORKSPACE_ID,
        promptFolderId
      })

    const sourceLoad = await loadFolder(SOURCE_FOLDER_ID)
    const destinationLoad = await loadFolder(DESTINATION_FOLDER_ID)
    const sourceFolder = sourceLoad.promptFolders.find(
      (folder: { id: string }) => folder.id === SOURCE_FOLDER_ID
    )
    const destinationFolder = destinationLoad.promptFolders.find(
      (folder: { id: string }) => folder.id === DESTINATION_FOLDER_ID
    )
    const templateId = 'ipc-template'
    const createResult = await invoke('create-prompt-template', {
      promptFolder: toPayloadEntity(sourceFolder),
      content: {
        id: templateId,
        expectedRevision: 0,
        data: {
          id: templateId,
          title: '',
          fallbackTitle: '',
          createdAt: '',
          modifiedAt: '',
          templateText: 'Initial {{value}}.'
        }
      },
      previousEntryId: null
    })

    expect(createResult).toMatchObject({
      success: true,
      payload: {
        content: {
          data: {
            title: '',
            fallbackTitle: 'New Template',
            templateText: 'Initial {{value}}.'
          }
        }
      }
    })
    expect(createResult.payload.content.data).not.toHaveProperty('status')
    expect(
      await readTextFile(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Source/New Template.template.md`
      )
    ).toContain('Initial {{value}}.')
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Source/_FolderInfo/FolderOrder.json`
        )
      )
    ).toEqual({ entries: [{ kind: 'template', id: templateId }] })

    const updateResult = await invoke('update-prompt-template', {
      content: {
        ...toPayloadEntity(createResult.payload.content),
        data: {
          ...createResult.payload.content.data,
          title: 'Renamed Template',
          fallbackTitle: '',
          modifiedAt: '2026-07-24T12:00:00.000Z',
          templateText: 'Updated {{value}}.'
        }
      }
    })

    expect(updateResult).toMatchObject({
      success: true,
      payload: {
        content: {
          data: {
            title: 'Renamed Template',
            fallbackTitle: '',
            templateText: 'Updated {{value}}.'
          }
        }
      }
    })
    expect(
      await checkFileExists(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Source/New Template.template.md`
      )
    ).toBe(false)
    expect(
      await readTextFile(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Source/Renamed Template.template.md`
      )
    ).toContain('Updated {{value}}.')

    const moveResult = await invoke('move-prompt-template', {
      sourcePromptFolder: toPayloadEntity(updateResult.payload.promptFolder),
      destinationPromptFolder: toPayloadEntity(destinationFolder),
      content: toPayloadEntity(updateResult.payload.content),
      previousEntryId: null
    })

    expect(moveResult).toMatchObject({
      success: true,
      payload: {
        sourcePromptFolder: { data: { entries: [] } },
        destinationPromptFolder: {
          data: { entries: [{ kind: 'template', id: 'ipc-template' }] }
        }
      }
    })
    expect(
      await checkFileExists(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Source/Renamed Template.template.md`
      )
    ).toBe(false)
    expect(
      await readTextFile(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Destination/Renamed Template.template.md`
      )
    ).toContain('Updated {{value}}.')
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Source/_FolderInfo/FolderOrder.json`
        )
      )
    ).toEqual({ entries: [] })
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Destination/_FolderInfo/FolderOrder.json`
        )
      )
    ).toEqual({ entries: [{ kind: 'template', id: templateId }] })

    const deleteResult = await invoke('delete-prompt-template', {
      promptFolder: toPayloadEntity(moveResult.payload.destinationPromptFolder),
      content: toPayloadEntity(moveResult.payload.content)
    })

    expect(deleteResult).toMatchObject({
      success: true,
      payload: { promptFolder: { data: { entries: [] } } }
    })
    expect(
      await checkFileExists(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Destination/Renamed Template.template.md`
      )
    ).toBe(false)
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Destination/_FolderInfo/FolderOrder.json`
        )
      )
    ).toEqual({ entries: [] })
  })
})
