import { describe, expect, it, vi } from 'vitest'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { loadWorkspaceByPath } from '@renderer/data/Queries/WorkspaceQuery'

const ipcInvokeWithPayload = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/IpcRequestInvoke', () => ({
  ipcInvokeWithPayload
}))

describe('prompt template renderer loading', () => {
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
              folderDescription: 'Template description',
              folderPrefix: null,
              folderSuffix: null
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
  })
})
