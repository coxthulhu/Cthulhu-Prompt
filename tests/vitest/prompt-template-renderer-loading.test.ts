import { beforeEach, describe, expect, it, vi } from 'vitest'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { createPromptTemplateSummary } from '@shared/PromptTemplate'
import { loadWorkspaceByPath } from '@renderer/data/Queries/WorkspaceQuery'
import { loadPromptFolderInitial } from '@renderer/data/Queries/PromptFolderQuery'
import { promptTemplateDraftCollection } from '@renderer/data/Collections/PromptTemplateDraftCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { upsertPromptTemplateSummaryDrafts } from '@renderer/data/UiState/PromptTemplateDraftMutations.svelte.ts'

const ipcInvokeWithPayload = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/IpcRequestInvoke', () => ({
  ipcInvokeWithPayload
}))

describe('prompt template renderer loading', () => {
  beforeEach(() => {
    promptTemplateCollection.utils.deleteAuthoritative('renderer-template')
    if (promptTemplateDraftCollection.has('renderer-template')) {
      promptTemplateDraftCollection.delete('renderer-template')
    }
    promptFolderCollection.utils.deleteAuthoritative('renderer-template-folder')
  })

  it('stores workspace template summaries in the renderer collection', async () => {
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
            settings: {
              folderDescription: 'Template description'
            }
          }
        }
      ],
      prompts: [],
      promptTemplates: [
        {
          id: 'renderer-template',
          revision: 0,
          data: {
            id: 'renderer-template',
            title: 'Renderer Template',
            fallbackTitle: '',
            modifiedAt: '2026-07-22T12:00:00.000Z'
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
      loadingState: 'summary'
    })
    expect(promptTemplateDraftCollection.get('renderer-template')).toMatchObject({
      title: 'Renderer Template',
      templateText: '',
      isEdited: false
    })
  })

  it('replaces a template summary and its draft with full folder-query data', async () => {
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
    upsertPromptTemplateSummaryDrafts([summary])
    promptTemplateDraftCollection.update(summary.id, (draft) => {
      draft.isEdited = true
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
            settings: { folderDescription: 'Template description' }
          }
        }
      ],
      prompts: [],
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
      promptUiStates: []
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
    expect(promptTemplateDraftCollection.get('renderer-template')).toMatchObject({
      templateText: 'Review {{change}}.',
      isEdited: true
    })
  })
})
