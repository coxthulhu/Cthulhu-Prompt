import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { runSqlQuery, runSqlStatement } from '../helpers/UserPersistenceHelpers'

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
      command: {
        promptFolderId: SOURCE_FOLDER_ID,
        contentId: templateId,
        title: '',
        fallbackTitle: '',
        templateText: 'Initial {{value}}.',
        createdAt: '2026-08-30T12:00:00Z',
        previousEntryId: null,
        categoryId: null
      },
      expectations: [
        {
          entityType: 'promptFolder',
          id: SOURCE_FOLDER_ID,
          expected: 'revision',
          revision: sourceFolder.revision
        },
        {
          entityType: 'promptTemplate',
          id: templateId,
          expected: 'absent'
        }
      ]
    })

    expect(createResult).toMatchObject({
      success: true,
      payload: {
        snapshots: expect.arrayContaining([
          expect.objectContaining({ entityType: 'promptFolder', id: SOURCE_FOLDER_ID }),
          expect.objectContaining({
            entityType: 'promptTemplate',
            id: templateId,
            data: expect.objectContaining({
              title: '',
              fallbackTitle: 'New Template',
              templateText: 'Initial {{value}}.'
            })
          })
        ])
      }
    })
    /** Created template snapshot returned by the generic domain response. */
    const createdTemplate = createResult.payload.snapshots.find(
      (snapshot: { entityType: string; id: string }) =>
        snapshot.entityType === 'promptTemplate' && snapshot.id === templateId
    )
    /** Source folder snapshot after template creation. */
    const createdSourceFolder = createResult.payload.snapshots.find(
      (snapshot: { entityType: string; id: string }) =>
        snapshot.entityType === 'promptFolder' && snapshot.id === SOURCE_FOLDER_ID
    )
    expect(createdTemplate.data).not.toHaveProperty('status')
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
    ).toEqual({
      categories: [
        { categoryId: null, entries: [{ kind: 'template', id: templateId }] }
      ]
    })

    const updateResult = await invoke('update-prompt-template', {
      command: {
        contentId: createdTemplate.id,
        title: 'Renamed Template',
        fallbackTitle: '',
        modifiedAt: '2026-07-24T12:00:00Z',
        templateText: 'Updated {{value}}.'
      },
      expectations: [
        {
          entityType: 'promptTemplate',
          id: createdTemplate.id,
          expected: 'revision',
          revision: createdTemplate.revision
        }
      ]
    })

    expect(updateResult).toMatchObject({
      success: true,
      payload: {
        snapshots: [
          {
            entityType: 'promptTemplate',
            id: createdTemplate.id,
            data: {
              title: 'Renamed Template',
              fallbackTitle: '',
              templateText: 'Updated {{value}}.'
            }
          }
        ]
      }
    })
    /** Updated template snapshot returned by the single-target domain response. */
    const updatedTemplate = updateResult.payload.snapshots[0]
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
      command: {
        sourcePromptFolderId: SOURCE_FOLDER_ID,
        destinationPromptFolderId: DESTINATION_FOLDER_ID,
        contentId: updatedTemplate.id,
        previousEntryId: null,
        categoryId: null
      },
      expectations: [
        {
          entityType: 'promptFolder',
          id: SOURCE_FOLDER_ID,
          expected: 'revision',
          revision: createdSourceFolder.revision
        },
        {
          entityType: 'promptFolder',
          id: DESTINATION_FOLDER_ID,
          expected: 'revision',
          revision: destinationFolder.revision
        },
        {
          entityType: 'promptTemplate',
          id: updatedTemplate.id,
          expected: 'revision',
          revision: updatedTemplate.revision
        }
      ]
    })

    expect(moveResult).toMatchObject({
      success: true,
      payload: {
        snapshots: expect.arrayContaining([
          expect.objectContaining({
            entityType: 'promptFolder',
            id: SOURCE_FOLDER_ID,
            data: expect.objectContaining({
              categoryOrder: { categories: [{ categoryId: null, entries: [] }] }
            })
          }),
          expect.objectContaining({
            entityType: 'promptFolder',
            id: DESTINATION_FOLDER_ID,
            data: expect.objectContaining({
              categoryOrder: {
                categories: [
                  {
                    categoryId: null,
                    entries: [{ kind: 'template', id: 'ipc-template' }]
                  }
                ]
              }
            })
          })
        ])
      }
    })
    /** Destination folder snapshot returned by the generic domain response. */
    const movedDestinationFolder = moveResult.payload.snapshots.find(
      (snapshot: { entityType: string; id: string }) =>
        snapshot.entityType === 'promptFolder' && snapshot.id === DESTINATION_FOLDER_ID
    )
    /** Moved template snapshot returned by the generic domain response. */
    const movedTemplate = moveResult.payload.snapshots.find(
      (snapshot: { entityType: string; id: string }) =>
        snapshot.entityType === 'promptTemplate' && snapshot.id === templateId
    )
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
    ).toEqual({ categories: [{ categoryId: null, entries: [] }] })
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Destination/_FolderInfo/FolderOrder.json`
        )
      )
    ).toEqual({
      categories: [
        { categoryId: null, entries: [{ kind: 'template', id: templateId }] }
      ]
    })

    await runSqlStatement(
      electronApp,
      `INSERT INTO markdown_content_ui_state (workspace_id, content_id, editor_view_state_json)
       VALUES ('${WORKSPACE_ID}', '${templateId}', '{}'),
              ('${WORKSPACE_ID}', 'sibling-template', '{}')`
    )
    expect(
      (
        await runSqlQuery(
          electronApp,
          `SELECT content_id AS contentId FROM markdown_content_ui_state
           WHERE workspace_id = '${WORKSPACE_ID}'
           ORDER BY content_id`
        )
      ).rows
    ).toEqual([{ contentId: templateId }, { contentId: 'sibling-template' }])
    const deleteResult = await invoke('delete-prompt-template', {
      command: {
        workspaceId: WORKSPACE_ID,
        promptFolderId: DESTINATION_FOLDER_ID,
        contentId: templateId
      },
      expectations: [
        {
          entityType: 'promptFolder',
          id: DESTINATION_FOLDER_ID,
          expected: 'revision',
          revision: movedDestinationFolder.revision
        },
        {
          entityType: 'promptTemplate',
          id: templateId,
          expected: 'revision',
          revision: movedTemplate.revision
        }
      ]
    })

    expect(deleteResult).toMatchObject({
      success: true,
      payload: {
        snapshots: expect.arrayContaining([
          expect.objectContaining({
            entityType: 'promptFolder',
            id: DESTINATION_FOLDER_ID,
            data: expect.objectContaining({
              categoryOrder: { categories: [{ categoryId: null, entries: [] }] }
            })
          }),
          { entityType: 'promptTemplate', id: templateId, deleted: true },
          {
            entityType: 'markdownContentUiState',
            id: `${WORKSPACE_ID}:${templateId}`,
            deleted: true
          }
        ])
      }
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
    ).toEqual({ categories: [{ categoryId: null, entries: [] }] })
    expect(
      (
        await runSqlQuery(
          electronApp,
          `SELECT content_id FROM markdown_content_ui_state
           WHERE workspace_id = '${WORKSPACE_ID}'
             AND content_id IN ('${templateId}', 'sibling-template')
           ORDER BY content_id`
        )
      ).rows
    ).toEqual([{ content_id: 'sibling-template' }])
  })
})
