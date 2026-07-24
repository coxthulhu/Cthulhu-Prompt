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

vi.mock('../../src/main/DataAccess/PromptUiStateDataAccess', () => ({
  PromptUiStateDataAccess: {
    cleanupWorkspacePromptUiState: vi.fn()
  }
}))

describe('prompt template workspace loading', () => {
  it('loads nested template folders and sends template summaries to the renderer', async () => {
    const workspacePath = '/ws/template-loading'
    vol.fromJSON(
      createWorkspaceWithTemplateFolders(workspacePath, [
        {
          folderName: 'Root',
          displayName: 'Root Templates',
          folderId: 'template-root',
          description: 'Root description',
          subfolders: [
            {
              folderName: 'Nested',
              displayName: 'Nested Templates',
              folderId: 'template-nested',
              description: 'Nested description',
              templates: [
                {
                  id: 'nested-template',
                  title: 'Nested Template',
                  templateText: 'Use {{value}}.'
                }
              ]
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
    expect(result.promptFolders.map((folder) => folder.id)).toEqual([
      'template-root',
      'template-nested'
    ])
    const rootTemplateFolder = result.promptFolders.find(
      (folder) => folder.id === 'template-root'
    )?.data
    expect(rootTemplateFolder).toMatchObject({
      kind: 'template',
      entries: [{ kind: 'folder', id: 'template-nested' }]
    })
    expect(rootTemplateFolder?.settings).toEqual({
      folderDescription: 'Root description'
    })
    expect(result.promptTemplates).toHaveLength(1)
    const templateModifiedAt = vol
      .statSync(`${workspacePath}/Templates/Root/Nested/Nested Template.template.md`)
      .mtime.toISOString()
    expect(result.promptTemplates[0]?.data).toMatchObject({
      id: 'nested-template',
      title: 'Nested Template',
      fallbackTitle: '',
      modifiedAt: templateModifiedAt
    })

    const folderResult = await loadPromptFolderInitialData({
      workspaceId: result.workspace.id,
      promptFolderId: 'template-root'
    })
    if (!folderResult.success) throw new Error(folderResult.error)

    expect(folderResult.prompts).toEqual([])
    expect(folderResult.promptUiStates).toEqual([])
    expect(folderResult.promptTemplates).toHaveLength(1)
    expect(folderResult.promptTemplates[0]?.data).toMatchObject({
      id: 'nested-template',
      title: 'Nested Template',
      templateText: 'Use {{value}}.'
    })
  })
})
