import { createPromptStatusFolderLayouts } from '@shared/domain/prompt-collection/PromptCollection'
import { vol } from 'memfs'
import { describe, expect, it, vi } from 'vitest'
import { setFs } from '../../src/main/fs-provider'
import { loadWorkspaceByPath } from '../../src/main/Workspace/WorkspaceLoader'
import { loadPromptCollectionInitialData } from '../../src/main/Queries/PromptCollectionQuery'
import {
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'

// This loader test isolates content hydration; Playwright covers actual SQLite order persistence.
vi.mock('../../src/main/Persistence/sqlite/SqliteDataAccess', () => ({
  SqliteDataAccess: { runTransaction: <T>(commands: () => T): T => commands() }
}))

// An unsaved user order exercises alphabetical discovery without opening a native database.
vi.mock('../../src/main/Persistence/sqlite/WorkspaceStateDataAccess', () => ({
  WorkspaceStateDataAccess: { read: vi.fn(() => null), write: vi.fn() }
}))

vi.mock('../../src/main/Persistence/sqlite/WorkspaceUiStateDataAccess', () => ({
  WorkspaceUiStateDataAccess: {
    cleanupWorkspacePromptCollectionUiState: vi.fn()
  }
}))

vi.mock('../../src/main/Persistence/sqlite/MarkdownContentUiStateDataAccess', () => ({
  MarkdownContentUiStateDataAccess: {
    cleanupWorkspaceMarkdownContentUiState: vi.fn(),
    readMarkdownContentUiState: vi.fn(() => null),
    readMarkdownContentUiStates: vi.fn(() => [])
  }
}))

describe('prompt template workspace loading', () => {
  it('loads a flat template root and sends full templates to the renderer', async () => {
    const workspacePath = '/ws/template-loading'
    vol.fromJSON(
      createWorkspaceWithTemplateCollections(workspacePath, [
        {
          folderName: 'Root',
          displayName: 'Root Templates',
          collectionId: 'template-root',
          description: 'Root description',
          templates: [
            {
              id: 'category-template',
              title: 'Category Template',
              templateText: 'Use {{value}}.'
            }
          ]
        }
      ])
    )
    setFs(vol)

    const result = await loadWorkspaceByPath(getWorkspaceInfoPath(workspacePath))
    if (!result.success) throw new Error(result.error)

    expect(result.workspace.data.promptCollectionEntries).toEqual([])
    expect(result.workspace.data.templateCollectionEntries).toEqual([
      { kind: 'collection', id: 'template-root' }
    ])
    expect(result.promptCollections.map((collection) => collection.id)).toEqual(['template-root'])
    const rootTemplateCollection = result.promptCollections.find(
      (collection) => collection.id === 'template-root'
    )?.data
    expect(rootTemplateCollection).toMatchObject({
      kind: 'template',
      statusFolders: createPromptStatusFolderLayouts({ categoryOrders: { active: {
        categories: [
          {
            categoryId: null,
            entries: [{ kind: 'template', id: 'category-template' }]
          }
        ]
      } } })
    })
    expect(rootTemplateCollection?.settings).toEqual({
      collectionDescription: 'Root description'
    })
    expect(result.promptTemplates).toHaveLength(1)
    const templateModifiedAt = vol
      .statSync(`${workspacePath}/Templates/Root/Active/Category Template.template.md`)
      .mtime.toISOString()
    expect(result.promptTemplates[0]?.data).toMatchObject({
      id: 'category-template',
      title: 'Category Template',
      fallbackTitle: '',
      modifiedAt: templateModifiedAt,
      templateText: 'Use {{value}}.'
    })

    const collectionResult = await loadPromptCollectionInitialData({
      workspaceId: result.workspace.id,
      promptCollectionId: 'template-root'
    })
    if (!collectionResult.success) throw new Error(collectionResult.error)

    expect(collectionResult.prompts).toEqual([])
    expect(collectionResult.markdownContentUiStates).toEqual([])
    expect(collectionResult.promptTemplates).toHaveLength(1)
    expect(collectionResult.promptTemplates[0]?.data).toMatchObject({
      id: 'category-template',
      title: 'Category Template',
      templateText: 'Use {{value}}.'
    })
  })
})
