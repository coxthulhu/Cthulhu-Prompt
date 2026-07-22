import { vol } from 'memfs'
import { describe, expect, it, vi } from 'vitest'
import { setFs } from '../../src/main/fs-provider'
import { loadWorkspaceByPath } from '../../src/main/Registries/WorkspaceLoader'
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

    expect(result.workspace.data.templateEntries).toEqual([
      { kind: 'folder', id: 'template-root' }
    ])
    expect(result.promptFolders.map((folder) => folder.id)).toEqual([
      'template-root',
      'template-nested'
    ])
    expect(result.promptFolders.find((folder) => folder.id === 'template-root')?.data).toMatchObject(
      {
        kind: 'template',
        entries: [{ kind: 'folder', id: 'template-nested' }],
        settings: {
          folderDescription: 'Root description',
          folderPrefix: null,
          folderSuffix: null
        }
      }
    )
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
  })
})
