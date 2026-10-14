import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { PromptStatus } from '../../src/shared/domain/prompt/Prompt'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { runSqlQuery, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/template-mutations'
const WORKSPACE_ID = '000000000000000000000000b22e429b'
const SOURCE_COLLECTION_ID = 'template-source'
const DESTINATION_COLLECTION_ID = 'template-destination'

describe('Prompt template mutations', () => {
  test('creates, updates, moves, and deletes a template through IPC', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [
        {
          folderName: 'Source',
          displayName: 'Source',
          collectionId: SOURCE_COLLECTION_ID
        },
        {
          folderName: 'Destination',
          displayName: 'Destination',
          collectionId: DESTINATION_COLLECTION_ID
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
    const loadCollection = async (promptCollectionId: string) =>
      await invoke('load-prompt-collection-initial', {
        workspaceId: WORKSPACE_ID,
        promptCollectionId
      })

    const sourceLoad = await loadCollection(SOURCE_COLLECTION_ID)
    const destinationLoad = await loadCollection(DESTINATION_COLLECTION_ID)
    const sourceCollection = sourceLoad.promptCollections.find(
      (collection: { id: string }) => collection.id === SOURCE_COLLECTION_ID
    )
    const destinationCollection = destinationLoad.promptCollections.find(
      (collection: { id: string }) => collection.id === DESTINATION_COLLECTION_ID
    )
    const templateId = 'ipc-template'
    const createResult = await invoke('create-prompt-template', {
      command: {
        promptCollectionId: SOURCE_COLLECTION_ID,
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
          entityType: 'promptCollection',
          id: SOURCE_COLLECTION_ID,
          expected: 'revision',
          revision: sourceCollection.revision
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
          expect.objectContaining({ entityType: 'promptCollection', id: SOURCE_COLLECTION_ID }),
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
    /** Source collection snapshot after template creation. */
    const createdSourceCollection = createResult.payload.snapshots.find(
      (snapshot: { entityType: string; id: string }) =>
        snapshot.entityType === 'promptCollection' && snapshot.id === SOURCE_COLLECTION_ID
    )
    expect(createdTemplate.data.status).toBe(PromptTemplateStatus.Active)
    expect(
      await readTextFile(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Source/Active/New Template.template.md`
      )
    ).toContain('Initial {{value}}.')
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Source/Active/_CollectionInfo/CategoryOrder.json`
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
        `${WORKSPACE_PATH}/Templates/Source/Active/New Template.template.md`
      )
    ).toBe(false)
    expect(
      await readTextFile(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Source/Active/Renamed Template.template.md`
      )
    ).toContain('Updated {{value}}.')

    /** Complete template destination accepted by the shared prompt-location channel. */
    const locationCommand = {
      kind: 'template',
      sourcePromptCollectionId: SOURCE_COLLECTION_ID,
      promptId: updatedTemplate.id,
      location: { promptCollectionId: DESTINATION_COLLECTION_ID, categoryId: null, previousEntryId: null, status: PromptTemplateStatus.Active },
      modifiedAt: '2026-08-30T12:00:00Z'
    }
    /** Invalid kinds, template statuses, and nested fields must fail before persistence. */
    for (const command of [
      { ...locationCommand, kind: 'unknown' },
      ...[PromptStatus.Todo, PromptStatus.InProgress, PromptStatus.Backlog, PromptStatus.Completed].map((status) => ({
        ...locationCommand, location: { ...locationCommand.location, status }
      })),
      { ...locationCommand, location: { ...locationCommand.location, extra: true } },
      { ...locationCommand, location: { ...locationCommand.location, previousEntryId: undefined } }
    ]) {
      expect(await invoke('set-prompt-location', { command, expectations: [] })).toMatchObject({
        success: false, error: 'Invalid request payload'
      })
    }

    const moveResult = await invoke('set-prompt-location', {
      command: locationCommand,
      expectations: [
        {
          entityType: 'promptCollection',
          id: SOURCE_COLLECTION_ID,
          expected: 'revision',
          revision: createdSourceCollection.revision
        },
        {
          entityType: 'promptCollection',
          id: DESTINATION_COLLECTION_ID,
          expected: 'revision',
          revision: destinationCollection.revision
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
            entityType: 'promptCollection',
            id: SOURCE_COLLECTION_ID,
            data: expect.objectContaining({
              statusFolders: expect.objectContaining({ active: expect.objectContaining({ categoryOrder: { categories: [{ categoryId: null, entries: [] }] } }) })
            })
          }),
          expect.objectContaining({
            entityType: 'promptCollection',
            id: DESTINATION_COLLECTION_ID,
            data: expect.objectContaining({
              statusFolders: expect.objectContaining({ active: expect.objectContaining({ categoryOrder: {
                categories: [
                  {
                    categoryId: null,
                    entries: [{ kind: 'template', id: 'ipc-template' }]
                  }
                ]
              } }) })
            })
          })
        ])
      }
    })
    /** Destination collection snapshot returned by the generic domain response. */
    const movedDestinationCollection = moveResult.payload.snapshots.find(
      (snapshot: { entityType: string; id: string }) =>
        snapshot.entityType === 'promptCollection' && snapshot.id === DESTINATION_COLLECTION_ID
    )
    /** Moved template snapshot returned by the generic domain response. */
    const movedTemplate = moveResult.payload.snapshots.find(
      (snapshot: { entityType: string; id: string }) =>
        snapshot.entityType === 'promptTemplate' && snapshot.id === templateId
    )
    expect(
      await checkFileExists(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Source/Active/Renamed Template.template.md`
      )
    ).toBe(false)
    expect(
      await readTextFile(
        electronApp,
        `${WORKSPACE_PATH}/Templates/Destination/Active/Renamed Template.template.md`
      )
    ).toContain('Updated {{value}}.')
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Source/Active/_CollectionInfo/CategoryOrder.json`
        )
      )
    ).toEqual({ categories: [{ categoryId: null, entries: [] }] })
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Destination/Active/_CollectionInfo/CategoryOrder.json`
        )
      )
    ).toEqual({
      categories: [
        { categoryId: null, entries: [{ kind: 'template', id: templateId }] }
      ]
    })

    for (const contentId of [templateId, 'sibling-template']) {
      await seedWorkspaceState(electronApp, WORKSPACE_ID, 'markdown-editor', contentId, { editorViewStateJson: '{}' }, 'machine-specific')
    }
    expect(
      (
        await runSqlQuery(
          electronApp,
          `SELECT entity_id AS contentId FROM workspace_state
           WHERE state_type = 'markdown-editor' AND workspace_id = '${WORKSPACE_ID}'
           ORDER BY entity_id`
        )
      ).rows
    ).toEqual([{ contentId: templateId }, { contentId: 'sibling-template' }])
    const deleteResult = await invoke('delete-prompt-template', {
      command: {
        workspaceId: WORKSPACE_ID,
        promptCollectionId: DESTINATION_COLLECTION_ID,
        contentId: templateId
      },
      expectations: [
        {
          entityType: 'promptCollection',
          id: DESTINATION_COLLECTION_ID,
          expected: 'revision',
          revision: movedDestinationCollection.revision
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
            entityType: 'promptCollection',
            id: DESTINATION_COLLECTION_ID,
            data: expect.objectContaining({
              statusFolders: expect.objectContaining({ active: expect.objectContaining({ categoryOrder: { categories: [{ categoryId: null, entries: [] }] } }) })
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
        `${WORKSPACE_PATH}/Templates/Destination/Active/Renamed Template.template.md`
      )
    ).toBe(false)
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Templates/Destination/Active/_CollectionInfo/CategoryOrder.json`
        )
      )
    ).toEqual({ categories: [{ categoryId: null, entries: [] }] })
    expect(
      (
        await runSqlQuery(
          electronApp,
          `SELECT entity_id AS content_id FROM workspace_state
           WHERE state_type = 'markdown-editor' AND workspace_id = '${WORKSPACE_ID}'
             AND entity_id IN ('${templateId}', 'sibling-template')
           ORDER BY entity_id`
        )
      ).rows
    ).toEqual([{ content_id: 'sibling-template' }])
  })
})
