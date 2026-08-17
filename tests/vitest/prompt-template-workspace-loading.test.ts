import { vol } from 'memfs'
import { describe, expect, it, vi } from 'vitest'
import { setFs } from '../../src/main/fs-provider'
import { loadWorkspaceByPath } from '../../src/main/Registries/WorkspaceLoader'
import { loadPromptFolderInitialData } from '../../src/main/Queries/PromptFolderQuery'
import {
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'

vi.mock('../../src/main/DataAccess/UserPersistenceDataAccess', () => ({
  UserPersistenceDataAccess: {
    cleanupWorkspacePromptFolderUiState: vi.fn()
  }
}))

vi.mock('../../src/main/DataAccess/MarkdownContentUiStateDataAccess', () => ({
  MarkdownContentUiStateDataAccess: {
    cleanupWorkspaceMarkdownContentUiState: vi.fn(),
    readMarkdownContentUiStates: vi.fn(() => [])
  }
}))

describe('prompt template workspace loading', () => {
  it('loads a flat template root and sends full templates to the renderer', async () => {
    const workspacePath = '/ws/template-loading'
    vol.fromJSON(
      createWorkspaceWithTemplateFolders(workspacePath, [
        {
          folderName: 'Root',
          displayName: 'Root Templates',
          folderId: 'template-root',
          description: 'Root description',
          templates: [
            {
              id: 'nested-template',
              title: 'Nested Template',
              templateText: 'Use {{value}}.'
            }
          ]
        }
      ])
    )
    setFs(vol)

    const result = await loadWorkspaceByPath(getWorkspaceInfoPath(workspacePath))
    if (!result.success) throw new Error(result.error)

    expect(result.workspace.data.entries).toEqual([
      { kind: 'folder', id: 'template-root' }
    ])
    expect(result.promptFolders.map((folder) => folder.id)).toEqual(['template-root'])
    const rootTemplateFolder = result.promptFolders.find(
      (folder) => folder.id === 'template-root'
    )?.data
    expect(rootTemplateFolder).toMatchObject({
      kind: 'template',
      categoryOrder: {
        categories: [
          {
            categoryId: null,
            entries: [{ kind: 'template', id: 'nested-template' }]
          }
        ]
      }
    })
    expect(rootTemplateFolder?.settings).toEqual({
      folderDescription: 'Root description'
    })
    expect(result.promptTemplates).toHaveLength(1)
    const templateModifiedAt = vol
      .statSync(`${workspacePath}/Templates/Root/Nested Template.template.md`)
      .mtime.toISOString()
    expect(result.promptTemplates[0]?.data).toMatchObject({
      id: 'nested-template',
      title: 'Nested Template',
      fallbackTitle: '',
      modifiedAt: templateModifiedAt,
      templateText: 'Use {{value}}.'
    })

    const folderResult = await loadPromptFolderInitialData({
      workspaceId: result.workspace.id,
      promptFolderId: 'template-root'
    })
    if (!folderResult.success) throw new Error(folderResult.error)

    expect(folderResult.prompts).toEqual([])
    expect(folderResult.markdownContentUiStates).toEqual([])
    expect(folderResult.promptTemplates).toHaveLength(1)
    expect(folderResult.promptTemplates[0]?.data).toMatchObject({
      id: 'nested-template',
      title: 'Nested Template',
      templateText: 'Use {{value}}.'
    })
  })
})
