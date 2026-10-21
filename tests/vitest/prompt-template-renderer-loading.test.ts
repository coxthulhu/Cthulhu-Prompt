import type { PromptTemplateCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { createPromptStatusFolderLayouts } from '@shared/domain/prompt-collection/PromptCollection'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { createPromptTemplateSummary } from '@shared/domain/prompt-template/PromptTemplate'
import { loadWorkspaceByPath } from '@renderer/data/Queries/WorkspaceQuery'
import { loadPromptCollectionInitial } from '@renderer/data/Queries/PromptCollectionQuery'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { promptCollectionClientStateCollection } from '@renderer/data/Collections/PromptCollectionClientStateCollection'
import { upsertPromptTemplateClientStates } from '@renderer/data/UiState/client-state/PromptTemplateClientStateMutations.svelte.ts'

const ipcInvokeWithPayload = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/IpcRequestInvoke', () => ({
  ipcInvokeWithPayload
}))

describe('prompt template renderer loading', () => {
  beforeEach(() => {
    promptTemplatesCollection.utils.deleteAuthoritative('renderer-template')
    if (promptTemplateClientStateCollection.has('renderer-template')) {
      promptTemplateClientStateCollection.delete('renderer-template')
    }
    promptCollectionsCollection.utils.deleteAuthoritative('renderer-template-collection')
    if (promptCollectionClientStateCollection.has('renderer-template-collection')) {
      promptCollectionClientStateCollection.delete('renderer-template-collection')
    }
  })

  it('stores full workspace templates and template edit markers in the renderer', async () => {
    ipcInvokeWithPayload.mockResolvedValue({
      success: true,
      workspace: {
        id: 'renderer-template-workspace',
        revision: 0,
        data: {
          id: 'renderer-template-workspace',
          workspacePath: 'C:\\Templates',
          workspaceName: 'Templates',
          /** Existing fixtures start without user favorites. */
          favoriteCollectionIds: { prompt: [], template: [] },
          promptCollectionEntries: [],
          templateCollectionEntries: [{ kind: 'collection', id: 'renderer-template-collection' }]
        }
      },
      promptCollections: [
        {
          id: 'renderer-template-collection',
          revision: 0,
          data: {
            id: 'renderer-template-collection',
            kind: 'template',
            folderName: 'Templates',
            displayName: 'Templates',
            entries: [{ kind: 'template', id: 'renderer-template' }],
            statusFolders: createPromptStatusFolderLayouts({ categoryOrders: { active: {
              categories: [
                {
                  categoryId: null,
                  entries: [{ kind: 'template', id: 'renderer-template' }]
                }
              ]
            } } }),
            settings: {
              collectionDescription: 'Template description'
            }
          }
        }
      ],
      prompts: [],
      categories: [],
      notes: [],
      attachedNoteUiStates: [],
      promptTemplates: [
        {
          id: 'renderer-template',
          revision: 0,
          data: {
            id: 'renderer-template',
            title: 'Renderer Template',
            fallbackTitle: '',
            createdAt: '2026-07-22T11:00:00.000Z',
            modifiedAt: '2026-07-22T12:00:00.000Z',
            templateText: 'Review [[PROMPT_TEXT]].'
          }
        }
      ]
    })

    await loadWorkspaceByPath('C:\\Templates\\Templates.cthulhuprompt.json')

    expect(promptTemplatesCollection.get('renderer-template')).toMatchObject({
      id: 'renderer-template',
      title: 'Renderer Template',
      fallbackTitle: '',
      modifiedAt: '2026-07-22T12:00:00.000Z',
      templateText: 'Review [[PROMPT_TEXT]].',
      loadingState: 'full'
    })
    expect(promptTemplateClientStateCollection.get('renderer-template')).toMatchObject({
      id: 'renderer-template',
      isEdited: false
    })
    expect(promptTemplateClientStateCollection.get('renderer-template')).not.toHaveProperty(
      'templateText'
    )
    expect(promptCollectionClientStateCollection.get('renderer-template-collection')).toMatchObject({
      id: 'renderer-template-collection',
      hasLoadedInitialData: false
    })
    expect(promptCollectionClientStateCollection.get('renderer-template-collection')).not.toHaveProperty(
      'settings'
    )
    expect(promptCollectionsCollection.get('renderer-template-collection')?.settings.collectionDescription).toBe(
      'Template description'
    )

    promptCollectionClientStateCollection.update('renderer-template-collection', (clientState) => {
      clientState.hasLoadedInitialData = true
    })
    await loadWorkspaceByPath('C:\\Templates\\Templates.cthulhuprompt.json')
    expect(promptCollectionClientStateCollection.get('renderer-template-collection')).toMatchObject({
      hasLoadedInitialData: true
    })
  })

  it('replaces a template summary while preserving its edited marker', async () => {
    promptCollectionsCollection.utils.upsertAuthoritative({
      id: 'renderer-template-collection',
      revision: 0,
      data: {
        id: 'renderer-template-collection',
        kind: 'template',
        folderName: 'Templates',
        displayName: 'Templates',
        entries: [{ kind: 'template', id: 'renderer-template' }],
        statusFolders: createPromptStatusFolderLayouts({ categoryOrders: { active: {
          categories: [
            {
              categoryId: null,
              entries: [{ kind: 'template', id: 'renderer-template' }]
            }
          ]
        } } }),
        settings: { collectionDescription: 'Template description' }
      } as PromptTemplateCollection
    })
    const summary = {
      id: 'renderer-template',
      title: 'Renderer Template',
      fallbackTitle: '',
      modifiedAt: '2026-07-22T12:00:00.000Z'
    }
    promptTemplatesCollection.utils.upsertAuthoritative({
      id: summary.id,
      revision: 0,
      data: createPromptTemplateSummary(summary)
    })
    upsertPromptTemplateClientStates([summary])
    promptTemplateClientStateCollection.update(summary.id, (clientState) => {
      clientState.isEdited = true
    })
    expect(promptTemplatesCollection.get(summary.id)?.loadingState).toBe('summary')

    ipcInvokeWithPayload.mockResolvedValue({
      success: true,
      promptCollections: [
        {
          id: 'renderer-template-collection',
          revision: 0,
          data: {
            id: 'renderer-template-collection',
            kind: 'template',
            folderName: 'Templates',
            displayName: 'Templates',
            entries: [{ kind: 'template', id: 'renderer-template' }],
            statusFolders: createPromptStatusFolderLayouts({ categoryOrders: { active: {
              categories: [
                {
                  categoryId: null,
                  entries: [{ kind: 'template', id: 'renderer-template' }]
                }
              ]
            } } }),
            settings: { collectionDescription: 'Template description' }
          }
        }
      ],
      prompts: [],
      categories: [],
      notes: [],
      attachedNoteUiStates: [],
      promptTemplates: [
        {
          id: 'renderer-template',
          revision: 0,
          data: {
            id: 'renderer-template',
            title: 'Renderer Template',
            fallbackTitle: '',
            createdAt: '2026-07-22T11:00:00.000Z',
            modifiedAt: '2026-07-22T12:00:00.000Z',
            templateText: 'Review {{change}}.'
          }
        }
      ],
      markdownContentUiStates: []
    })

    await loadPromptCollectionInitial('renderer-template-workspace', 'renderer-template-collection')

    expect(ipcInvokeWithPayload).toHaveBeenCalledWith('load-prompt-collection-initial', {
      workspaceId: 'renderer-template-workspace',
      promptCollectionId: 'renderer-template-collection'
    })

    expect(promptTemplatesCollection.get('renderer-template')).toMatchObject({
      loadingState: 'full',
      templateText: 'Review {{change}}.'
    })
    expect(promptTemplateClientStateCollection.get('renderer-template')).toMatchObject({
      id: 'renderer-template',
      isEdited: true
    })
    expect(promptTemplateClientStateCollection.get('renderer-template')).not.toHaveProperty(
      'title'
    )
    expect(promptCollectionClientStateCollection.get('renderer-template-collection')).toMatchObject({
      id: 'renderer-template-collection',
      hasLoadedInitialData: true
    })
  })
})
