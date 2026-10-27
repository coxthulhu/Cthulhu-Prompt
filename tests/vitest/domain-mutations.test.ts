import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type {
  DomainChange,
  DomainChangeFor,
  DomainUpdateRecipe,
  DomainEntityType,
  DomainPlannerEntityMap,
  DomainState
} from '@shared/domain/DomainChanges'
import {
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation,
  planMoveCategoryDomainMutation,
  planSaveCategoriesDomainMutation,
  planSetCategoryDescriptionDomainMutation,
  planUpdateCategoryDetailsDomainMutation
} from '@shared/domain/category/CategoryDomainMutations'
import {
  planCreatePromptDomainMutation,
  planCreatePromptTemplateDomainMutation,
  planPromptTemplateUpdate,
  planPromptUpdate,
} from '@shared/domain/markdown-content/MarkdownContentDomainMutations'
import { getMarkdownContentCategoryOrder } from '@shared/domain/markdown-content/MarkdownContent'
import { PromptStatus, PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import {
  createPromptStatusFolderLayouts,
  type PromptCollection
} from '@shared/domain/prompt-collection/PromptCollection'
import {
  planCreatePromptCollectionDomainMutation,
  planMovePromptCollectionDomainMutation,
  planRenamePromptCollectionDomainMutation
} from '@shared/domain/prompt-collection/PromptCollectionDomainMutations'
import { planSetPromptLocationDomainMutation } from '@shared/domain/prompt/PromptDomainMutations'
import { SYSTEM_SETTINGS_ID } from '@shared/domain/settings/SystemSettings'
import { planSetSystemSettingsDomainMutation } from '@shared/domain/settings/SystemSettingsDomainMutations'
import { parseCreateAttachedNoteCommand, planCreateAttachedNote } from '@shared/domain/note/NoteDomainMutations'

/** Narrows a planner update whose entity and operation are established by its test case. */
const getUpdateRecipe = <TEntityType extends DomainEntityType>(change: DomainChange): DomainUpdateRecipe<TEntityType> =>
  (change as DomainChange & { recipe: DomainUpdateRecipe<TEntityType> }).recipe

/** Complete in-memory entity graph used by shared planner tests. */
type TestDomainEntities = {
  [TEntityType in DomainEntityType]: Array<DomainPlannerEntityMap[TEntityType]>
}

/** Reports whether one test entity owns the requested framework target ID. */
const hasTestDomainEntityId = (
  entityType: DomainEntityType,
  entity: DomainPlannerEntityMap[DomainEntityType],
  id: string
): boolean => {
  /** Uniform record view used to derive singleton and composite UI-state keys. */
  const record = entity as unknown as Record<string, unknown>
  if (entityType === 'systemSettings') return id === SYSTEM_SETTINGS_ID
  if (entityType === 'workspaceUiState') return record.workspaceId === id
  if (entityType === 'markdownContentUiState') {
    return `${record.workspaceId}:${record.contentId}` === id
  }
  if (entityType === 'attachedNoteUiState') return `${record.workspaceId}:${record.noteId}` === id
  if (entityType === 'workspacePromptCollectionUiState') {
    return `${record.workspaceId}:${record.contentOwnerId}` === id
  }
  if (entityType === 'accordionUiState') {
    return `${record.workspaceId}:${record.persistenceId}` === id
  }
  return record.id === id
}

/** Creates shared domain state from test-specific entity arrays. */
const createDomainState = (
  overrides: Partial<TestDomainEntities>
): DomainState => {
  /** Complete entity map with empty defaults for unrelated types. */
  const entities = {
    systemSettings: [],
    workspace: [],
    promptCollection: [],
    category: [],
    prompt: [],
    note: [],
    promptTemplate: [],
    userPersistence: [],
    markdownContentUiState: [],
    /** Complete graph includes independently persisted attachment preferences. */
    attachedNoteUiState: [],
    workspaceUiState: [],
    workspacePromptCollectionUiState: [],
    accordionUiState: [],
    ...overrides
  } as TestDomainEntities
  return {
    get: (entityType, id) =>
      entities[entityType].find((entity) =>
        hasTestDomainEntityId(entityType, entity, id)
      ) as
        | DomainPlannerEntityMap[typeof entityType]
        | undefined,
    getAll: (entityType) => entities[entityType]
  }
}

/** Creates one collection with an optional category and ordered content entry. */
const createCollection = (
  id: string,
  kind: PromptCollection['kind'],
  categoryId: string | null,
  entryId?: string
): PromptCollection => {
  /** Category order shared by the selected prompt status folder or template root. */
  const categoryOrder = {
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
  }
  /** Common root fields shared across the prompt/template union. */
  const baseCollection = {
    id,
    folderName: id,
    displayName: id,
    settings: { collectionDescription: null }
  }
  return kind === 'prompt'
    ? {
        ...baseCollection,
        kind,
        statusFolders: createPromptStatusFolderLayouts({
          categoryOrders: { [PromptStatusFolderId.Active]: categoryOrder }
        })
      }
    : { ...baseCollection, kind, statusFolders: createPromptStatusFolderLayouts({ categoryOrders: { active: categoryOrder } }) }
}

describe('shared domain mutation planners', () => {
  for (const ownerKind of ['prompt', 'template'] as const) {
    it(`creates a visible ${ownerKind} note and its workspace preference in one plan`, () => {
      const owner = { id: 'owner', title: 'Owner', fallbackTitle: '', modifiedAt: 'old', status: PromptStatus.Todo }
      const collection = createCollection('root', ownerKind, 'category', owner.id)
      const workspace = {
        id: 'workspace', workspacePath: 'C:\\Workspace', workspaceName: 'Workspace',
        favoriteCollectionIds: { prompt: [], template: [] },
        promptCollectionEntries: ownerKind === 'prompt' ? [{ kind: 'collection' as const, id: 'root' }] : [],
        templateCollectionEntries: ownerKind === 'template' ? [{ kind: 'collection' as const, id: 'root' }] : []
      }
      const state = createDomainState({
        workspace: [workspace], promptCollection: [collection],
        ...(ownerKind === 'prompt' ? { prompt: [owner] } : {
          promptTemplate: [{ ...owner, status: PromptTemplateStatus.Active }]
        })
      })
      const command = { ownerKind, ownerId: owner.id, noteId: 'note', modifiedAt: '2026-10-27T12:00:00Z' }
      expect(parseCreateAttachedNoteCommand(command)).toEqual(command)
      expect(parseCreateAttachedNoteCommand({ ...command, visible: false })).toBeNull()
      expect(parseCreateAttachedNoteCommand({ ...command, extra: true })).toBeNull()
      const { noteId: _noteId, ...missingIdentity } = command
      expect(parseCreateAttachedNoteCommand(missingIdentity)).toBeNull()

      const plan = planCreateAttachedNote(state, command)
      expect(Array.isArray(plan)).toBe(true)
      if (!Array.isArray(plan)) throw new Error('Expected creation changes')
      expect(plan).toHaveLength(3)
      expect(plan).toContainEqual({ type: 'insert', entityType: 'attachedNoteUiState', id: 'workspace:note',
        data: { workspaceId: 'workspace', noteId: 'note', visible: true } })
      expect(produce(owner, getUpdateRecipe<'prompt'>(plan[0]!))).toMatchObject({ attachedNoteId: 'note' })
      expect(planCreateAttachedNote(createDomainState({
        prompt: [owner], promptTemplate: [{ ...owner, status: PromptTemplateStatus.Active }], promptCollection: [collection]
      }), command)).toMatchObject({ status: 'conflict' })
      expect(planCreateAttachedNote(createDomainState({
        prompt: [{ ...owner, attachedNoteId: 'existing' }],
        promptTemplate: [{ ...owner, status: PromptTemplateStatus.Active, attachedNoteId: 'existing' }]
      }), command)).toMatchObject({ status: 'conflict' })
    })
  }

  it('plans a normalized collection rename as one collection update', () => {
    /** collection selected for the rename. */
    const collection = createCollection('root', 'prompt', null)
    /** Workspace establishing the collection's sibling scope. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      /** Existing fixtures start without user favorites. */
      favoriteCollectionIds: { prompt: [], template: [] },
      promptCollectionEntries: [{ kind: 'collection' as const, id: collection.id }],
      templateCollectionEntries: []
    }
    /** Shared rename plan applied in renderer and main process. */
    const plan = planRenamePromptCollectionDomainMutation(
      createDomainState({ workspace: [workspace], promptCollection: [collection] }),
      { promptCollectionId: collection.id, displayName: '  Renamed Root  ' }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan).toHaveLength(1)
    /** Collection projection after applying the shared rename recipe. */
    const renamedCollection = produce(collection, getUpdateRecipe<'promptCollection'>(plan[0]!))
    expect(renamedCollection).toMatchObject({
      id: collection.id,
      displayName: 'Renamed Root',
      folderName: 'RenamedRoot'
    })
  })

  it('plans collection creation and exact workspace reordering', () => {
    /** Existing sibling root used as the creation predecessor. */
    const sibling = createCollection('sibling', 'prompt', null)
    /** Workspace receiving the new root after its sibling. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      /** Existing fixtures start without user favorites. */
      favoriteCollectionIds: { prompt: [], template: [] },
      promptCollectionEntries: [{ kind: 'collection' as const, id: sibling.id }],
      templateCollectionEntries: []
    }
    /** Root creation plan shared by renderer and main. */
    const createPlan = planCreatePromptCollectionDomainMutation(
      createDomainState({ workspace: [workspace], promptCollection: [sibling] }),
      {
        workspaceId: workspace.id,
        promptCollectionId: 'created',
        displayName: ' Created Root ',
        previousEntryId: sibling.id,
        kind: 'prompt'
      }
    )
    expect(Array.isArray(createPlan)).toBe(true)
    if (!Array.isArray(createPlan)) return
    /** Workspace projection after the creation placement recipe. */
    const workspaceAfterCreate = produce(workspace, getUpdateRecipe<'workspace'>(createPlan[0]!))
    expect(workspaceAfterCreate.promptCollectionEntries.map((entry) => entry.id)).toEqual([
      sibling.id,
      'created'
    ])
    expect(createPlan[1]).toMatchObject({
      type: 'insert',
      entityType: 'promptCollection',
      id: 'created',
      data: { displayName: 'Created Root', folderName: 'CreatedRoot' }
    })

    /** Workspace containing both roots for the reorder plan. */
    const populatedWorkspace = {
      ...workspace,
      /** Existing fixtures start without user favorites. */
      favoriteCollectionIds: { prompt: [], template: [] },
      promptCollectionEntries: [
        { kind: 'collection' as const, id: sibling.id },
        { kind: 'collection' as const, id: 'created' }
      ]
    }
    /** Created root projected from the insertion plan. */
    const createdRoot = (createPlan[1]! as Extract<DomainChangeFor<'promptCollection'>, { type: 'insert' }>).data
    /** Root reorder plan moving the created root to the beginning. */
    const movePlan = planMovePromptCollectionDomainMutation(
      createDomainState({
        workspace: [populatedWorkspace],
        promptCollection: [sibling, createdRoot]
      }),
      { workspaceId: workspace.id, promptCollectionId: 'created', previousEntryId: null }
    )
    expect(Array.isArray(movePlan)).toBe(true)
    if (!Array.isArray(movePlan)) return
    expect(
      produce(populatedWorkspace, getUpdateRecipe<'workspace'>(movePlan[0]!)).promptCollectionEntries.map(
        (entry) => entry.id
      )
    ).toEqual(['created', sibling.id])
  })

  it('plans category creation as one root update and one insertion', () => {
    /** Root that will own the new category group. */
    const collection = createCollection('root', 'prompt', null)
    /** Shared creation plan produced against an absent stable category ID. */
    const plan = planCreateCategoryDomainMutation(
      createDomainState({ promptCollection: [collection] }),
      {
        categoryId: 'created',
        promptCollectionId: collection.id,
        displayName: '  Created  ',
        shortDescription: '  New category summary.  ',
        description: '  # Created\n\nCategory guidance.  '
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Collection projection after applying the ownership recipe. */
    const projectedCollection = produce(collection, getUpdateRecipe<'promptCollection'>(plan[0]!))
    expect(getMarkdownContentCategoryOrder(projectedCollection).categories[1]?.categoryId).toBe(
      'created'
    )
    expect(plan[1]).toEqual({
      type: 'insert',
      entityType: 'category',
      id: 'created',
      data: {
        id: 'created',
        displayName: 'Created',
        shortDescription: 'New category summary.',
        description: '  # Created\n\nCategory guidance.  '
      }
    })

    /** Separate creation plan verifies whitespace-only Markdown is represented as absent. */
    const whitespaceDescriptionPlan = planCreateCategoryDomainMutation(
      createDomainState({ promptCollection: [collection] }),
      {
        categoryId: 'whitespace-description',
        promptCollectionId: collection.id,
        displayName: 'Whitespace Description',
        shortDescription: null,
        description: '  \n  '
      }
    )
    expect(Array.isArray(whitespaceDescriptionPlan)).toBe(true)
    if (!Array.isArray(whitespaceDescriptionPlan)) return
    expect((whitespaceDescriptionPlan[1] as Extract<DomainChangeFor<'category'>, { type: 'insert' }> | undefined)?.data).toMatchObject({ description: null })
  })

  it('plans category deletion from summary projections with one renderer timestamp', () => {
    /** Root owning the category and its prompt reference. */
    const collection = createCollection('root', 'prompt', 'category', 'prompt')
    /** Workspace establishing ownership of the deleted category's root. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      /** Existing fixtures start without user favorites. */
      favoriteCollectionIds: { prompt: [], template: [] },
      promptCollectionEntries: [{ kind: 'collection' as const, id: collection.id }],
      templateCollectionEntries: []
    }
    /** Planner state containing summary-compatible prompt and template projections. */
    const state = createDomainState({
      workspace: [workspace],
      promptCollection: [collection],
      category: [
        { id: 'category', displayName: 'Shared', shortDescription: null, description: null }
      ],
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
      promptCollectionId: 'root',
      workspaceId: workspace.id,
      modifiedAt: 'renderer-time'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptCollection:root',
      'category:category',
      'prompt:prompt',
      'promptTemplate:template',
      'workspacePromptCollectionUiState:workspace:category'
    ])

    /** Prompt projection after applying the shared cleanup recipe. */
    const prompt = produce(state.get('prompt', 'prompt')!, getUpdateRecipe<'prompt'>(plan[2]!))
    /** Template projection after applying the shared cleanup recipe. */
    const template = produce(state.get('promptTemplate', 'template')!, getUpdateRecipe<'promptTemplate'>(plan[3]!))
    expect(prompt).not.toHaveProperty('category')
    expect(template).not.toHaveProperty('category')
    expect(prompt.modifiedAt).toBe('renderer-time')
    expect(template.modifiedAt).toBe('renderer-time')
  })

  it('plans one deterministic multi-category save and rejects duplicate retained IDs', () => {
    /** Root containing the retained and deleted category groups. */
    const collection = createCollection('root', 'prompt', 'category-a', 'prompt-a')
    getMarkdownContentCategoryOrder(collection).categories.push({
      categoryId: 'category-b',
      entries: [{ kind: 'prompt', id: 'prompt-b' }]
    })
    /** Workspace proving direct ownership of the managed root. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      /** Existing fixtures start without user favorites. */
      favoriteCollectionIds: { prompt: [], template: [] },
      promptCollectionEntries: [{ kind: 'collection' as const, id: collection.id }],
      templateCollectionEntries: []
    }
    /** Existing category records split between retention and staged deletion. */
    const categories = [
      {
        id: 'category-a',
        displayName: 'Category A',
        shortDescription: null,
        description: null
      },
      {
        id: 'category-b',
        displayName: 'Category B',
        shortDescription: null,
        description: null
      }
    ]
    /** Summary prompts exercising retained ordering and deleted-reference cleanup. */
    const prompts = [
      {
        id: 'prompt-a',
        title: 'Prompt A',
        fallbackTitle: '',
        modifiedAt: 'old',
        category: 'category-a',
        status: PromptStatus.Todo
      },
      {
        id: 'prompt-b',
        title: 'Prompt B',
        fallbackTitle: '',
        modifiedAt: 'old',
        category: 'category-b',
        status: PromptStatus.Todo
      }
    ]
    /** Domain graph used for both the valid and duplicate-ID plans. */
    const state = createDomainState({
      workspace: [workspace],
      promptCollection: [collection],
      category: categories,
      prompt: prompts
    })
    /** Atomic command updating one category, inserting two, and deleting one. */
    const command = {
      workspaceId: workspace.id,
      promptCollectionId: collection.id,
      categories: [
        {
          id: 'category-a',
          displayName: ' Renamed A ',
          shortDescription: ' Summary. ',
          description: null
        },
        {
          id: 'new-one',
          displayName: ' New One ',
          shortDescription: null,
          description: null
        },
        {
          id: 'new-two',
          displayName: 'New Two',
          shortDescription: null,
          description: null
        }
      ],
      modifiedAt: 'renderer-time'
    }
    /** Complete atomic change list produced for the retained set. */
    const plan = planSaveCategoriesDomainMutation(state, command)
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptCollection:root',
      'category:category-a',
      'category:new-one',
      'category:new-two',
      'category:category-b',
      'prompt:prompt-b',
      'workspacePromptCollectionUiState:workspace:category-b'
    ])
    /** Root projection after deleted content moves and new groups prepend as a block. */
    const projectedCollection = produce(collection, getUpdateRecipe<'promptCollection'>(plan[0]!))
    expect(
      getMarkdownContentCategoryOrder(projectedCollection).categories.map((group) => ({
        categoryId: group.categoryId,
        entries: group.entries.map((entry) => entry.id)
      }))
    ).toEqual([
      { categoryId: null, entries: ['prompt-b'] },
      { categoryId: 'new-one', entries: [] },
      { categoryId: 'new-two', entries: [] },
      { categoryId: 'category-a', entries: ['prompt-a'] }
    ])
    /** Updated retained category projection after shared normalization. */
    const projectedCategory = produce(categories[0]!, getUpdateRecipe<'category'>(plan[1]!))
    expect(projectedCategory).toMatchObject({
      displayName: 'Renamed A',
      shortDescription: 'Summary.'
    })
    /** Deleted prompt projection after category cleanup and timestamp replacement. */
    const projectedPrompt = produce(prompts[1]!, getUpdateRecipe<'prompt'>(plan[5]!))
    expect(projectedPrompt).not.toHaveProperty('category')
    expect(projectedPrompt.modifiedAt).toBe('renderer-time')

    /** Duplicate-ID plan rejected before any category changes are projected. */
    const duplicatePlan = planSaveCategoriesDomainMutation(state, {
      ...command,
      categories: [command.categories[0]!, command.categories[0]!]
    })
    expect(duplicatePlan).toMatchObject({ status: 'conflict' })
  })

  it('maps active category navigation to the root and preserves inactive root selection', () => {
    /** Root owning the category whose view state is deleted. */
    const collection = createCollection('root', 'prompt', 'category')
    /** Workspace establishing root ownership for both deletion plans. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      /** Existing fixtures start without user favorites. */
      favoriteCollectionIds: { prompt: [], template: [] },
      promptCollectionEntries: [{ kind: 'collection' as const, id: collection.id }],
      templateCollectionEntries: []
    }
    /** Existing root state whose expansion fields must survive selection transfer. */
    const rootUiState = {
      workspaceId: workspace.id,
      contentOwnerId: collection.id,
      selectedEntryId: 'existing-root-selection',
      treeIsExpanded: false,
      contentSectionIsExpanded: false,
      scrollTopByMode: {},
      selectedMode: PromptStatusFolderId.Active,
      shownFinalStatusGroups: {}
    }
    /** Category state selecting its category-only details row. */
    const categoryUiState = {
      workspaceId: workspace.id,
      contentOwnerId: 'category',
      selectedEntryId: 'category-details',
      treeIsExpanded: true,
      contentSectionIsExpanded: true,
      scrollTopByMode: {},
      selectedMode: PromptStatusFolderId.Active,
      shownFinalStatusGroups: {}
    }
    /** Active workspace navigation pointing at the deleted category owner. */
    const activeWorkspaceUiState = {
      workspaceId: workspace.id,
      selectedScreen: 'prompt-task-collections' as const,
      selectedScreenData: { promptCollectionId: collection.id, contentOwnerId: 'category' },
      lastPromptTaskCollectionId: collection.id,
      lastPromptTemplateCollectionId: null
    }
    /** Shared planner state containing active split UI-state records. */
    const activeState = createDomainState({
      workspace: [workspace],
      promptCollection: [collection],
      category: [
        { id: 'category', displayName: 'Category', shortDescription: null, description: null }
      ],
      workspaceUiState: [activeWorkspaceUiState],
      workspacePromptCollectionUiState: [rootUiState, categoryUiState]
    })
    /** Active-category deletion plan containing workspace and root selection updates. */
    const activePlan = planDeleteCategoryDomainMutation(activeState, {
      categoryId: 'category',
      promptCollectionId: collection.id,
      workspaceId: workspace.id,
      modifiedAt: 'renderer-time'
    })
    expect(Array.isArray(activePlan)).toBe(true)
    if (!Array.isArray(activePlan)) return
    /** Root UI-state update selected from the complete deletion plan. */
    const rootUpdate = activePlan.find(
      (change) =>
        change.type === 'update' &&
        change.entityType === 'workspacePromptCollectionUiState' &&
        change.id === `${workspace.id}:${collection.id}`
    )
    expect(rootUpdate?.type).toBe('update')
    if (rootUpdate?.type !== 'update') return
    expect(produce(rootUiState, getUpdateRecipe<'workspacePromptCollectionUiState'>(rootUpdate))).toEqual({
      ...rootUiState,
      selectedEntryId: 'collection-header'
    })

    /** Inactive navigation already owned by the root and retaining its selection. */
    const inactiveWorkspaceUiState = {
      ...activeWorkspaceUiState,
      selectedScreenData: { promptCollectionId: collection.id, contentOwnerId: collection.id }
    }
    /** Inactive-category plan that must not update workspace or root UI state. */
    const inactivePlan = planDeleteCategoryDomainMutation(
      createDomainState({
        workspace: [workspace],
        promptCollection: [collection],
        category: [
          { id: 'category', displayName: 'Category', shortDescription: null, description: null }
        ],
        workspaceUiState: [inactiveWorkspaceUiState],
        workspacePromptCollectionUiState: [rootUiState, categoryUiState]
      }),
      {
        categoryId: 'category',
        promptCollectionId: collection.id,
        workspaceId: workspace.id,
        modifiedAt: 'renderer-time'
      }
    )
    expect(Array.isArray(inactivePlan)).toBe(true)
    if (!Array.isArray(inactivePlan)) return
    expect(
      inactivePlan.some(
        (change) =>
          change.type === 'update' &&
          (change.entityType === 'workspaceUiState' ||
            change.entityType === 'workspacePromptCollectionUiState')
      )
    ).toBe(false)
  })

  it('plans category details and group reordering', () => {
    /** Root containing two categorized groups. */
    const collection = createCollection('root', 'prompt', 'category-a')
    getMarkdownContentCategoryOrder(collection).categories.push({
      categoryId: 'category-b',
      entries: []
    })
    /** Categories participating in details collision validation. */
    const categories = [
      { id: 'category-a', displayName: 'A', shortDescription: null, description: null },
      {
        id: 'category-b',
        displayName: 'B',
        shortDescription: null,
        description: 'Existing full description.'
      }
    ]
    /** Shared category-details plan. */
    const detailsPlan = planUpdateCategoryDetailsDomainMutation(
      createDomainState({ promptCollection: [collection], category: categories }),
      {
        categoryId: 'category-b',
        displayName: ' Renamed ',
        shortDescription: '  Updated summary.  '
      }
    )
    expect(Array.isArray(detailsPlan)).toBe(true)
    if (!Array.isArray(detailsPlan)) return
    expect(produce(categories[1]!, getUpdateRecipe<'category'>(detailsPlan[0]!))).toEqual({
      id: 'category-b',
      displayName: 'Renamed',
      shortDescription: 'Updated summary.',
      description: 'Existing full description.'
    })

    /** Shared category reorder plan moving B before A. */
    const movePlan = planMoveCategoryDomainMutation(
      createDomainState({ promptCollection: [collection], category: categories }),
      {
        promptCollectionId: collection.id,
        statusFolderId: PromptStatusFolderId.Active,
        categoryId: 'category-b',
        previousCategoryId: null
      }
    )
    expect(Array.isArray(movePlan)).toBe(true)
    if (!Array.isArray(movePlan)) return
    expect(
      getMarkdownContentCategoryOrder(produce(collection, getUpdateRecipe<'promptCollection'>(movePlan[0]!))).categories.map(
        (group) => group.categoryId
      )
    ).toEqual([null, 'category-b', 'category-a'])

    /** Template root proving status-free roots use the same category reorder planner. */
    const templateCollection = createCollection('templates', 'template', 'category-a')
    getMarkdownContentCategoryOrder(templateCollection).categories.push({
      categoryId: 'category-b',
      entries: []
    })
    /** Shared template category reorder plan using its null status-folder identity. */
    const templateMovePlan = planMoveCategoryDomainMutation(
      createDomainState({ promptCollection: [templateCollection], category: categories }),
      {
        promptCollectionId: templateCollection.id,
        statusFolderId: null,
        categoryId: 'category-b',
        previousCategoryId: null
      }
    )
    expect(Array.isArray(templateMovePlan)).toBe(true)
    if (!Array.isArray(templateMovePlan)) return
    expect(
      getMarkdownContentCategoryOrder(
        produce(templateCollection, getUpdateRecipe<'promptCollection'>(templateMovePlan[0]!))
      ).categories.map((group) => group.categoryId)
    ).toEqual([null, 'category-b', 'category-a'])
  })

  it('plans category descriptions and normalized system settings as single targets', () => {
    /** Category receiving a paced description replacement. */
    const category = {
      id: 'category',
      displayName: 'Category',
      shortDescription: null,
      description: null
    }
    /** Loaded singleton settings receiving a paced replacement. */
    const settings = {
      promptFontSize: 16,
      promptEditorMinLines: 2,
      promptEditorMaxLines: 35,
      attachedNoteMaxLines: 10,
      showLineNumbers: true,
      /** Default creation focus included in the complete settings record. */
      newPromptFocus: 'editor' as const,
      /** Automatic updates default to enabled in complete settings records. */
      automaticUpdates: true
    }
    /** Single-category description plan. */
    const categoryPlan = planSetCategoryDescriptionDomainMutation(
      createDomainState({ category: [category] }),
      { categoryId: category.id, description: 'Updated description.' }
    )
    expect(Array.isArray(categoryPlan)).toBe(true)
    if (!Array.isArray(categoryPlan)) return
    expect(categoryPlan).toHaveLength(1)
    expect(produce(category, getUpdateRecipe<'category'>(categoryPlan[0]!)).description).toBe('Updated description.')

    /** Single-settings plan normalized through the shared bounds. */
    const settingsPlan = planSetSystemSettingsDomainMutation(
      createDomainState({ systemSettings: [settings] }),
      {
        promptFontSize: 100,
        promptEditorMinLines: 3,
        promptEditorMaxLines: 30,
        attachedNoteMaxLines: 10,
        showLineNumbers: false,
        /** Default creation focus included in the complete settings record. */
        newPromptFocus: 'editor' as const,
        /** Automatic updates default to enabled in complete settings records. */
        automaticUpdates: true
      }
    )
    expect(Array.isArray(settingsPlan)).toBe(true)
    if (!Array.isArray(settingsPlan)) return
    expect(settingsPlan).toHaveLength(1)
    expect(produce(settings, getUpdateRecipe<'systemSettings'>(settingsPlan[0]!))).toEqual({
      promptFontSize: 32,
      promptEditorMinLines: 3,
      promptEditorMaxLines: 30,
      attachedNoteMaxLines: 10,
      showLineNumbers: false,
      /** Default creation focus included in the complete settings record. */
      newPromptFocus: 'editor' as const,
      /** Automatic updates default to enabled in complete settings records. */
      automaticUpdates: true
    })
  })

  it('plans prompt and template creation with synchronized root placement', () => {
    /** Prompt root receiving one newly created prompt. */
    const promptRoot = createCollection('prompts', 'prompt', null)
    /** Template root receiving one newly created template. */
    const templateRoot = createCollection('templates', 'template', null)
    /** Shared prompt creation plan. */
    const promptPlan = planCreatePromptDomainMutation(
      createDomainState({ promptCollection: [promptRoot] }),
      {
        promptCollectionId: promptRoot.id,
        statusFolderId: PromptStatusFolderId.Active,
        contentId: 'prompt',
        title: '',
        fallbackTitle: 'New Prompt',
        promptText: 'Text',
        createdAt: '2026-08-30T12:00:00Z',
        categoryId: null,
        previousEntryId: null
      }
    )
    expect(Array.isArray(promptPlan)).toBe(true)
    if (!Array.isArray(promptPlan)) return
    expect(promptPlan[1]).toMatchObject({
      type: 'insert',
      entityType: 'prompt',
      id: 'prompt',
      data: { status: PromptStatus.Todo, promptText: 'Text' }
    })
    expect(
      getMarkdownContentCategoryOrder(
        produce(promptRoot, getUpdateRecipe<'promptCollection'>(promptPlan[0]!))
      ).categories[0]?.entries
    ).toEqual([{ kind: 'prompt', id: 'prompt' }])

    /** Shared template creation plan. */
    const templatePlan = planCreatePromptTemplateDomainMutation(
      createDomainState({ promptCollection: [templateRoot] }),
      {
        promptCollectionId: templateRoot.id,
        contentId: 'template',
        title: '',
        fallbackTitle: '',
        templateText: 'Template',
        createdAt: '2026-08-30T12:00:00Z',
        categoryId: null,
        previousEntryId: null
      }
    )
    expect(Array.isArray(templatePlan)).toBe(true)
    if (!Array.isArray(templatePlan)) return
    expect(templatePlan[1]).toMatchObject({
      type: 'insert',
      entityType: 'promptTemplate',
      id: 'template',
      data: { fallbackTitle: 'New Template', templateText: 'Template' }
    })
  })

  it('plans prompt and template autosaves as single content targets', () => {
    /** Prompt root owning the full prompt update target. */
    const promptRoot = createCollection('prompts', 'prompt', null)
    getMarkdownContentCategoryOrder(promptRoot).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Template root owning the full template update target. */
    const templateRoot = createCollection('templates', 'template', null)
    getMarkdownContentCategoryOrder(templateRoot).categories[0]!.entries.push({
      kind: 'template',
      id: 'template'
    })
    /** Full prompt whose immutable ownership and workflow fields must survive autosave. */
    const prompt = {
      id: 'prompt',
      title: 'Old Prompt',
      fallbackTitle: '',
      createdAt: 'created',
      modifiedAt: 'old',
      promptText: 'Old prompt.',
      status: PromptStatus.Todo
    }
    /** Full template whose immutable creation data must survive autosave. */
    const template = {
      id: 'template',
      title: 'Old Template',
      fallbackTitle: '',
      createdAt: 'created',
      modifiedAt: 'old',
      templateText: 'Old template.'
    }
    /** Shared prompt autosave plan. */
    const promptPlan = planPromptUpdate(
      createDomainState({ promptCollection: [promptRoot], prompt: [prompt] }),
      {
        contentId: prompt.id,
        title: 'Updated Prompt',
        fallbackTitle: '',
        modifiedAt: '2026-08-30T12:00:00Z',
        promptText: 'Updated prompt.',
        templates: [{ id: 'template' }]
      }
    )
    expect(Array.isArray(promptPlan)).toBe(true)
    if (!Array.isArray(promptPlan)) return
    expect(promptPlan).toHaveLength(1)
    expect(produce(prompt, getUpdateRecipe<'prompt'>(promptPlan[0]!))).toEqual({
      ...prompt,
      title: 'Updated Prompt',
      modifiedAt: '2026-08-30T12:00:00Z',
      promptText: 'Updated prompt.',
      templates: [{ id: 'template' }]
    })

    /** Shared prompt-template autosave plan. */
    const templatePlan = planPromptTemplateUpdate(
      createDomainState({ promptCollection: [templateRoot], promptTemplate: [template] }),
      {
        contentId: template.id,
        title: 'Updated Template',
        fallbackTitle: '',
        modifiedAt: '2026-08-30T12:00:00Z',
        templateText: 'Updated template.'
      }
    )
    expect(Array.isArray(templatePlan)).toBe(true)
    if (!Array.isArray(templatePlan)) return
    expect(templatePlan).toHaveLength(1)
    expect(produce(template, getUpdateRecipe<'promptTemplate'>(templatePlan[0]!))).toEqual({
      ...template,
      title: 'Updated Template',
      modifiedAt: '2026-08-30T12:00:00Z',
      templateText: 'Updated template.'
    })
  })

  it('plans prompt completion from a summary projection', () => {
    /** Active prompt root containing the status target. */
    const collection = createCollection('root', 'prompt', null)
    getMarkdownContentCategoryOrder(collection).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Summary-compatible prompt selected for completion. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      status: PromptStatus.Todo
    }
    /** Shared status plan moving the prompt into Completed. */
    const plan = planSetPromptLocationDomainMutation(
      createDomainState({ promptCollection: [collection], prompt: [prompt] }),
      {
        kind: 'prompt',
        sourcePromptCollectionId: collection.id,
        promptId: prompt.id,
        location: { promptCollectionId: collection.id, categoryId: null, previousEntryId: null, status: PromptStatus.Completed },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Root projection after completion ownership changes. */
    const completedCollection = produce(collection, getUpdateRecipe<'promptCollection'>(plan[0]!))
    /** Prompt projection after completion fields are applied. */
    const completedPrompt = produce(prompt, getUpdateRecipe<'prompt'>(plan[1]!))
    expect(
      completedCollection.statusFolders[PromptStatusFolderId.Completed].promptIds
    ).toEqual([prompt.id])
    expect(
      completedCollection.statusFolders[PromptStatusFolderId.Active].categoryOrder
        .categories[0]?.entries
    ).toEqual([])
    expect(completedPrompt).toMatchObject({
      status: PromptStatus.Completed,
      finalizedAt: '2026-08-30T12:00:00Z',
      modifiedAt: '2026-08-30T12:00:00Z'
    })
  })

  it('resets finalization time when moving between final statuses', () => {
    /** Prompt root whose Completed layout currently owns the prompt. */
    const collection = createCollection('root', 'prompt', null)
    collection.statusFolders[PromptStatusFolderId.Completed].promptIds = ['prompt']
    /** Completed prompt carrying the timestamp that Archived must replace. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      status: PromptStatus.Completed,
      finalizedAt: '2026-08-29T12:00:00Z'
    }
    /** Shared status plan moving the prompt into Archived with a new timestamp. */
    const plan = planSetPromptLocationDomainMutation(
      createDomainState({ promptCollection: [collection], prompt: [prompt] }),
      {
        kind: 'prompt',
        sourcePromptCollectionId: collection.id,
        promptId: prompt.id,
        location: { promptCollectionId: collection.id, categoryId: null, previousEntryId: null, status: PromptStatus.Archived },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )

    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Root projection after ownership moves from Completed to Archived. */
    const archivedCollection = produce(collection, getUpdateRecipe<'promptCollection'>(plan[0]!))
    /** Prompt projection after Archived replaces its finalization timestamp. */
    const archivedPrompt = produce(prompt, getUpdateRecipe<'prompt'>(plan[1]!))
    expect(archivedCollection.statusFolders[PromptStatusFolderId.Completed].promptIds).toEqual([])
    expect(archivedCollection.statusFolders[PromptStatusFolderId.Archived].promptIds).toEqual([
      prompt.id
    ])
    expect(archivedPrompt).toMatchObject({
      status: PromptStatus.Archived,
      finalizedAt: '2026-08-30T12:00:00Z',
      modifiedAt: '2026-08-30T12:00:00Z'
    })
  })

  it('preserves ordering when a status changes within one status folder', () => {
    /** Active prompt root whose ordering must not be targeted by the status update. */
    const collection = createCollection('root', 'prompt', null)
    getMarkdownContentCategoryOrder(collection).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Todo prompt moving to In Progress inside the same Active status folder. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      status: PromptStatus.Todo
    }
    /** Shared status plan expected to update only the prompt entity. */
    const plan = planSetPromptLocationDomainMutation(
      createDomainState({ promptCollection: [collection], prompt: [prompt] }),
      {
        kind: 'prompt',
        sourcePromptCollectionId: collection.id,
        promptId: prompt.id,
        location: { promptCollectionId: collection.id, categoryId: null, previousEntryId: null, status: PromptStatus.InProgress },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )

    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'prompt:prompt'
    ])
    expect(produce(prompt, getUpdateRecipe<'prompt'>(plan[0]!))).toMatchObject({
      status: PromptStatus.InProgress,
      modifiedAt: '2026-08-30T12:00:00Z'
    })
  })

  it('transfers ordering when the root changes within one status folder', () => {
    /** Source root owning the prompt in its Active status folder. */
    const source = createCollection('source', 'prompt', null)
    getMarkdownContentCategoryOrder(source).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Destination root receiving the prompt in its own Active status folder. */
    const destination = createCollection('destination', 'prompt', null)
    /** Todo prompt changing roots while remaining inside the Active status-folder identity. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      status: PromptStatus.Todo
    }
    /** Shared status plan expected to transfer both root orderings and update the prompt. */
    const plan = planSetPromptLocationDomainMutation(
      createDomainState({ promptCollection: [source, destination], prompt: [prompt] }),
      {
        kind: 'prompt',
        sourcePromptCollectionId: source.id,
        promptId: prompt.id,
        location: { promptCollectionId: destination.id, categoryId: null, previousEntryId: null, status: PromptStatus.InProgress },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )

    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptCollection:source',
      'promptCollection:destination',
      'prompt:prompt'
    ])
    /** Source root after its Active ordering loses the prompt. */
    const projectedSource = produce(source, getUpdateRecipe<'promptCollection'>(plan[0]!))
    /** Destination root after its Active ordering receives the prompt. */
    const projectedDestination = produce(destination, getUpdateRecipe<'promptCollection'>(plan[1]!))
    expect(getMarkdownContentCategoryOrder(projectedSource).categories[0]?.entries).toEqual([])
    expect(getMarkdownContentCategoryOrder(projectedDestination).categories[0]?.entries).toEqual([
      { kind: 'prompt', id: prompt.id }
    ])
  })

  it('transfers prompt status ownership across collections', () => {
    /** Source root currently owning the active prompt. */
    const source = createCollection('source', 'prompt', null)
    getMarkdownContentCategoryOrder(source).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Destination root receiving the completed prompt. */
    const destination = createCollection('destination', 'prompt', null)
    /** Summary-compatible prompt selected for cross-root completion. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      status: PromptStatus.Todo
    }
    /** Shared status plan transferring ownership into the destination Completed hierarchy. */
    const plan = planSetPromptLocationDomainMutation(
      createDomainState({ promptCollection: [source, destination], prompt: [prompt] }),
      {
        kind: 'prompt',
        sourcePromptCollectionId: source.id,
        promptId: prompt.id,
        location: { promptCollectionId: destination.id, categoryId: null, previousEntryId: null, status: PromptStatus.Completed },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptCollection:source',
      'promptCollection:destination',
      'prompt:prompt'
    ])
    /** Source projection after active ownership is removed. */
    const projectedSource = produce(source, getUpdateRecipe<'promptCollection'>(plan[0]!))
    /** Destination projection after completed ownership is inserted. */
    const projectedDestination = produce(destination, getUpdateRecipe<'promptCollection'>(plan[1]!))
    expect(getMarkdownContentCategoryOrder(projectedSource).categories[0]?.entries).toEqual([])
    expect(
      projectedDestination.statusFolders[PromptStatusFolderId.Completed].promptIds
    ).toEqual([prompt.id])
  })

  it('clears stale category metadata when restoring a prompt to Uncategorized', () => {
    /** Root whose completed prompt retains its former category metadata. */
    const collection = createCollection('root', 'prompt', 'category')
    collection.statusFolders[PromptStatusFolderId.Completed].promptIds = ['prompt']
    /** Completed prompt being restored to the Uncategorized group. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      category: 'category',
      status: PromptStatus.Completed,
      finalizedAt: 'old'
    }
    /** Shared restoration plan targeting the Uncategorized group. */
    const plan = planSetPromptLocationDomainMutation(
      createDomainState({ promptCollection: [collection], prompt: [prompt] }),
      {
        kind: 'prompt',
        sourcePromptCollectionId: collection.id,
        promptId: prompt.id,
        location: { promptCollectionId: collection.id, categoryId: null, previousEntryId: null, status: PromptStatus.Todo },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Restored prompt projection after applying the shared recipe. */
    const restoredPrompt = produce(prompt, getUpdateRecipe<'prompt'>(plan[1]!))
    /** Root projection after restoring Active-tree ownership. */
    const restoredCollection = produce(collection, getUpdateRecipe<'promptCollection'>(plan[0]!))
    expect(restoredPrompt).not.toHaveProperty('category')
    expect(restoredPrompt).not.toHaveProperty('finalizedAt')
    expect(
      restoredCollection.statusFolders[PromptStatusFolderId.Active].categoryOrder
        .categories[0]?.entries
    ).toEqual([
      { kind: 'prompt', id: prompt.id }
    ])
  })

  it('returns the actual source in movement conflict targets', () => {
    /** Actual source containing the prompt despite the stale renderer command. */
    const actualSource = createCollection('actual-source', 'prompt', 'source-category', 'prompt')
    /** Stale claimed source containing no prompt reference. */
    const claimedSource = createCollection('claimed-source', 'prompt', null)
    /** Valid destination for the attempted movement. */
    const destination = createCollection('destination', 'prompt', 'destination-category')
    /** Planner conflict produced from authoritative ownership. */
    const conflict = planSetPromptLocationDomainMutation(
      createDomainState({
        promptCollection: [actualSource, claimedSource, destination],
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
        kind: 'prompt',
        sourcePromptCollectionId: 'claimed-source',
        promptId: 'prompt',
        location: { promptCollectionId: 'destination', categoryId: 'destination-category', previousEntryId: null, status: PromptStatus.Todo },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )
    expect(conflict).toEqual({
      status: 'conflict',
      reason: 'Prompt location ownership conflict',
      targets: [
        { entityType: 'promptCollection', id: 'actual-source' },
        { entityType: 'promptCollection', id: 'destination' },
        { entityType: 'prompt', id: 'prompt' }
      ]
    })
  })

  it('plans cross-root template movement and destination fallback resolution', () => {
    /** Source template root containing the blank-title template. */
    const source = createCollection('source', 'template', null)
    getMarkdownContentCategoryOrder(source).categories[0]!.entries.push({
      kind: 'template',
      id: 'moving'
    })
    /** Destination template root already containing the preferred fallback title. */
    const destination = createCollection('destination', 'template', null)
    getMarkdownContentCategoryOrder(destination).categories[0]!.entries.push({
      kind: 'template',
      id: 'existing'
    })
    /** Shared template movement plan. */
    const plan = planSetPromptLocationDomainMutation(
      createDomainState({
        promptCollection: [source, destination],
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
        kind: 'template',
        sourcePromptCollectionId: 'source',
        promptId: 'moving',
        location: { promptCollectionId: 'destination', categoryId: null, previousEntryId: 'existing', status: PromptTemplateStatus.Active },
        modifiedAt: '2026-08-30T12:00:00Z'
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
      getUpdateRecipe<'promptTemplate'>(plan[2]!)
    )
    expect(movedTemplate.fallbackTitle).toBe('New Template 1')
    // Pure movement retains the domain timestamp; persisted snapshots use filesystem mtime.
    expect(movedTemplate.modifiedAt).toBe('now')
  })
})
