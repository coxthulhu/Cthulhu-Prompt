import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type {
  DomainEntityType,
  DomainPlannerEntityMap,
  DomainState
} from '@shared/DomainChanges'
import {
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation
} from '@shared/CategoryDomainMutations'
import {
  planPromptMove,
  planPromptTemplateMove
} from '@shared/MarkdownContentDomainMutations'
import { PromptStatus } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import { planRenamePromptFolderDomainMutation } from '@shared/PromptFolderDomainMutations'

/** Complete in-memory entity graph used by shared planner tests. */
type TestDomainEntities = {
  [TEntityType in DomainEntityType]: Array<DomainPlannerEntityMap[TEntityType]>
}

/** Creates shared domain state from test-specific entity arrays. */
const createDomainState = (
  overrides: Partial<TestDomainEntities>
): DomainState => {
  /** Complete entity map with empty defaults for unrelated types. */
  const entities = {
    systemSettings: [],
    workspace: [],
    promptFolder: [],
    category: [],
    prompt: [],
    promptTemplate: [],
    ...overrides
  } as TestDomainEntities
  return {
    get: (entityType, id) =>
      entities[entityType].find((entity) => 'id' in entity && entity.id === id) as
        | DomainPlannerEntityMap[typeof entityType]
        | undefined,
    getAll: (entityType) => entities[entityType]
  }
}

/** Creates one root folder with an optional category and ordered content entry. */
const createRootFolder = (
  id: string,
  kind: PromptFolder['kind'],
  categoryId: string | null,
  entryId?: string
): PromptFolder => ({
  id,
  kind,
  folderName: id,
  displayName: id,
  completedPromptIds: [],
  categoryOrder: {
    categories: [
      { categoryId: null, entries: [] },
      ...(categoryId === null
        ? []
        : [
            {
              categoryId,
              entries: entryId ? [{ kind, id: entryId }] : []
            }
          ])
    ]
  },
  settings: { folderDescription: null }
})

describe('shared domain mutation planners', () => {
  it('plans a normalized root-folder rename as one folder update', () => {
    /** Root folder selected for the rename. */
    const folder = createRootFolder('root', 'prompt', null)
    /** Workspace establishing the folder's sibling scope. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      entries: [{ kind: 'folder' as const, id: folder.id }]
    }
    /** Shared rename plan applied in renderer and main process. */
    const plan = planRenamePromptFolderDomainMutation(
      createDomainState({ workspace: [workspace], promptFolder: [folder] }),
      { promptFolderId: folder.id, displayName: '  Renamed Root  ' }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan).toHaveLength(1)
    /** Folder projection after applying the shared rename recipe. */
    const renamedFolder = produce(folder, plan[0]!.recipe!)
    expect(renamedFolder).toMatchObject({
      id: folder.id,
      displayName: 'Renamed Root',
      folderName: 'RenamedRoot'
    })
  })

  it('plans category creation as one root update and one insertion', () => {
    /** Root that will own the new category group. */
    const folder = createRootFolder('root', 'prompt', null)
    /** Shared creation plan produced against an absent stable category ID. */
    const plan = planCreateCategoryDomainMutation(
      createDomainState({ promptFolder: [folder] }),
      { categoryId: 'created', promptFolderId: folder.id, displayName: '  Created  ' }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Folder projection after applying the ownership recipe. */
    const projectedFolder = produce(folder, plan[0]!.recipe!)
    expect(projectedFolder.categoryOrder.categories[1]?.categoryId).toBe('created')
    expect(plan[1]).toEqual({
      type: 'insert',
      entityType: 'category',
      id: 'created',
      data: { id: 'created', displayName: 'Created', description: null }
    })
  })

  it('plans category deletion from summary projections with one renderer timestamp', () => {
    /** Root owning the category and its prompt reference. */
    const folder = createRootFolder('root', 'prompt', 'category', 'prompt')
    /** Planner state containing summary-compatible prompt and template projections. */
    const state = createDomainState({
      promptFolder: [folder],
      category: [{ id: 'category', displayName: 'Shared', description: null }],
      prompt: [
        {
          id: 'prompt',
          title: 'Prompt',
          fallbackTitle: '',
          modifiedAt: 'old',
          category: 'category',
          status: PromptStatus.Todo
        }
      ],
      promptTemplate: [
        {
          id: 'template',
          title: 'Template',
          fallbackTitle: '',
          modifiedAt: 'old',
          category: 'category'
        }
      ]
    })
    /** Shared category deletion plan. */
    const plan = planDeleteCategoryDomainMutation(state, {
      categoryId: 'category',
      promptFolderId: 'root',
      modifiedAt: 'renderer-time'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptFolder:root',
      'category:category',
      'prompt:prompt',
      'promptTemplate:template'
    ])

    /** Prompt projection after applying the shared cleanup recipe. */
    const prompt = produce(state.get('prompt', 'prompt')!, plan[2]!.recipe!)
    /** Template projection after applying the shared cleanup recipe. */
    const template = produce(state.get('promptTemplate', 'template')!, plan[3]!.recipe!)
    expect(prompt).not.toHaveProperty('category')
    expect(template).not.toHaveProperty('category')
    expect(prompt.modifiedAt).toBe('renderer-time')
    expect(template.modifiedAt).toBe('renderer-time')
  })

  it('returns the actual source in movement conflict targets', () => {
    /** Actual source containing the prompt despite the stale renderer command. */
    const actualSource = createRootFolder('actual-source', 'prompt', 'source-category', 'prompt')
    /** Stale claimed source containing no prompt reference. */
    const claimedSource = createRootFolder('claimed-source', 'prompt', null)
    /** Valid destination for the attempted movement. */
    const destination = createRootFolder('destination', 'prompt', 'destination-category')
    /** Planner conflict produced from authoritative ownership. */
    const conflict = planPromptMove(
      createDomainState({
        promptFolder: [actualSource, claimedSource, destination],
        prompt: [
          {
            id: 'prompt',
            title: 'Prompt',
            fallbackTitle: '',
            modifiedAt: 'now',
            status: PromptStatus.Todo
          }
        ]
      }),
      {
        sourcePromptFolderId: 'claimed-source',
        destinationPromptFolderId: 'destination',
        contentId: 'prompt',
        categoryId: 'destination-category',
        previousEntryId: null
      }
    )
    expect(conflict).toEqual({
      status: 'conflict',
      reason: 'Markdown content ownership conflict',
      targets: [
        { entityType: 'promptFolder', id: 'actual-source' },
        { entityType: 'promptFolder', id: 'destination' },
        { entityType: 'prompt', id: 'prompt' }
      ]
    })
  })

  it('plans cross-root template movement and destination fallback resolution', () => {
    /** Source template root containing the blank-title template. */
    const source = createRootFolder('source', 'template', null)
    source.categoryOrder.categories[0]!.entries.push({ kind: 'template', id: 'moving' })
    /** Destination template root already containing the preferred fallback title. */
    const destination = createRootFolder('destination', 'template', null)
    destination.categoryOrder.categories[0]!.entries.push({ kind: 'template', id: 'existing' })
    /** Shared template movement plan. */
    const plan = planPromptTemplateMove(
      createDomainState({
        promptFolder: [source, destination],
        promptTemplate: [
          {
            id: 'moving',
            title: '',
            fallbackTitle: 'New Template',
            modifiedAt: 'now'
          },
          {
            id: 'existing',
            title: '',
            fallbackTitle: 'New Template',
            modifiedAt: 'now'
          }
        ]
      }),
      {
        sourcePromptFolderId: 'source',
        destinationPromptFolderId: 'destination',
        contentId: 'moving',
        categoryId: null,
        previousEntryId: 'existing'
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Template projection after applying the shared movement recipe. */
    const movedTemplate = produce(
      {
        id: 'moving',
        title: '',
        fallbackTitle: 'New Template',
        modifiedAt: 'now'
      },
      plan[2]!.recipe!
    )
    expect(movedTemplate.fallbackTitle).toBe('New Template 1')
  })
})
