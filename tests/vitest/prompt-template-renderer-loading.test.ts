import { beforeEach, describe, expect, it, vi } from 'vitest'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { createPromptTemplateSummary } from '@shared/PromptTemplate'
import { loadWorkspaceByPath } from '@renderer/data/Queries/WorkspaceQuery'
import { loadPromptFolderInitial } from '@renderer/data/Queries/PromptFolderQuery'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptFolderClientStateCollection } from '@renderer/data/Collections/PromptFolderClientStateCollection'
import { upsertPromptTemplateClientStates } from '@renderer/data/UiState/PromptTemplateClientStateMutations.svelte.ts'

const ipcInvokeWithPayload = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/IpcRequestInvoke', () => ({
  ipcInvokeWithPayload
}))

describe('prompt template renderer loading', () => {
  beforeEach(() => {
    promptTemplateCollection.utils.deleteAuthoritative('renderer-template')
    if (promptTemplateClientStateCollection.has('renderer-template')) {
      promptTemplateClientStateCollection.delete('renderer-template')
    }
    promptFolderCollection.utils.deleteAuthoritative('renderer-template-folder')
    if (promptFolderClientStateCollection.has('renderer-template-folder')) {
      promptFolderClientStateCollection.delete('renderer-template-folder')
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
          entries: [{ kind: 'folder', id: 'renderer-template-folder' }]
        }
      },
      promptFolders: [
        {
          id: 'renderer-template-folder',
          revision: 0,
          data: {
            id: 'renderer-template-folder',
            kind: 'template',
            folderName: 'Templates',
            displayName: 'Templates',
            entries: [{ kind: 'template', id: 'renderer-template' }],
            completedPromptIds: [],
            categoryOrder: {
              categories: [
                {
                  categoryId: null,
                  entries: [{ kind: 'template', id: 'renderer-template' }]
                }
              ]
            },
            settings: {
              folderDescription: 'Template description'
            }
          }
        }
      ],
      prompts: [],
      categories: [],
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

    expect(promptTemplateCollection.get('renderer-template')).toMatchObject({
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
    expect(promptFolderClientStateCollection.get('renderer-template-folder')).toMatchObject({
      id: 'renderer-template-folder',
      hasLoadedInitialData: false
    })
    expect(promptFolderClientStateCollection.get('renderer-template-folder')).not.toHaveProperty(
      'settings'
    )
    expect(promptFolderCollection.get('renderer-template-folder')?.settings.folderDescription).toBe(
      'Template description'
    )

    promptFolderClientStateCollection.update('renderer-template-folder', (clientState) => {
      clientState.hasLoadedInitialData = true
    })
    await loadWorkspaceByPath('C:\\Templates\\Templates.cthulhuprompt.json')
    expect(promptFolderClientStateCollection.get('renderer-template-folder')).toMatchObject({
      hasLoadedInitialData: true
    })
  })

  it('replaces a template summary while preserving its edited marker', async () => {
    promptFolderCollection.utils.upsertAuthoritative({
      id: 'renderer-template-folder',
      revision: 0,
      data: {
        id: 'renderer-template-folder',
        kind: 'template',
        folderName: 'Templates',
        displayName: 'Templates',
        entries: [{ kind: 'template', id: 'renderer-template' }],
        completedPromptIds: [],
        categoryOrder: {
          categories: [
            {
              categoryId: null,
              entries: [{ kind: 'template', id: 'renderer-template' }]
            }
          ]
        },
        settings: { folderDescription: 'Template description' }
      }
    })
    const summary = {
      id: 'renderer-template',
      title: 'Renderer Template',
      fallbackTitle: '',
      modifiedAt: '2026-07-22T12:00:00.000Z'
    }
    promptTemplateCollection.utils.upsertAuthoritative({
      id: summary.id,
      revision: 0,
      data: createPromptTemplateSummary(summary)
    })
    upsertPromptTemplateClientStates([summary])
    promptTemplateClientStateCollection.update(summary.id, (clientState) => {
      clientState.isEdited = true
    })
    expect(promptTemplateCollection.get(summary.id)?.loadingState).toBe('summary')

    ipcInvokeWithPayload.mockResolvedValue({
      success: true,
      promptFolders: [
        {
          id: 'renderer-template-folder',
          revision: 0,
          data: {
            id: 'renderer-template-folder',
            kind: 'template',
            folderName: 'Templates',
            displayName: 'Templates',
            entries: [{ kind: 'template', id: 'renderer-template' }],
            completedPromptIds: [],
            categoryOrder: {
              categories: [
                {
                  categoryId: null,
                  entries: [{ kind: 'template', id: 'renderer-template' }]
                }
              ]
            },
            settings: { folderDescription: 'Template description' }
          }
        }
      ],
      prompts: [],
      categories: [],
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

    await loadPromptFolderInitial('renderer-template-workspace', 'renderer-template-folder')

    expect(ipcInvokeWithPayload).toHaveBeenCalledWith('load-prompt-folder-initial', {
      workspaceId: 'renderer-template-workspace',
      promptFolderId: 'renderer-template-folder'
    })

    expect(promptTemplateCollection.get('renderer-template')).toMatchObject({
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
    expect(promptFolderClientStateCollection.get('renderer-template-folder')).toMatchObject({
      id: 'renderer-template-folder',
      hasLoadedInitialData: true
    })
  })
})
