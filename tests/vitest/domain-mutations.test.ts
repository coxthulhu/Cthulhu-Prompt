import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type {
  DomainEntityType,
  DomainPlannerEntityMap,
  DomainState
} from '@shared/DomainChanges'
import {
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation,
  planMoveCategoryDomainMutation,
  planRenameCategoryDomainMutation,
  planSetCategoryDescriptionDomainMutation
} from '@shared/CategoryDomainMutations'
import {
  planCreatePromptDomainMutation,
  planCreatePromptTemplateDomainMutation,
  planPromptMove,
  planPromptTemplateUpdate,
  planPromptUpdate,
  planPromptTemplateMove
} from '@shared/MarkdownContentDomainMutations'
import { getMarkdownContentCategoryOrder } from '@shared/MarkdownContent'
import { PromptStatus, PromptStatusFolderId } from '@shared/Prompt'
import {
  createPromptStatusFolderLayouts,
  type PromptFolder
} from '@shared/PromptFolder'
import {
  planCreatePromptFolderDomainMutation,
  planMovePromptFolderDomainMutation,
  planRenamePromptFolderDomainMutation
} from '@shared/PromptFolderDomainMutations'
import { planSetPromptStatusDomainMutation } from '@shared/PromptDomainMutations'
import { SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import { planSetSystemSettingsDomainMutation } from '@shared/SystemSettingsDomainMutations'

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
  if (entityType === 'workspacePromptFolderUiState') {
    return `${record.workspaceId}:${record.contentOwnerId}` === id
  }
  if (entityType === 'accordionUiState') {
    return `${record.workspaceId}:${record.persistenceId}` === id
  }
  if (entityType === 'categoryDescriptionEditorUiState') {
    return `${record.workspaceId}:${record.categoryId}` === id
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
    promptFolder: [],
    category: [],
    prompt: [],
    promptTemplate: [],
    userPersistence: [],
    markdownContentUiState: [],
    workspaceUiState: [],
    workspacePromptFolderUiState: [],
    accordionUiState: [],
    categoryDescriptionEditorUiState: [],
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

/** Creates one root folder with an optional category and ordered content entry. */
const createRootFolder = (
  id: string,
  kind: PromptFolder['kind'],
  categoryId: string | null,
  entryId?: string
): PromptFolder => {
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
  const baseFolder = {
    id,
    folderName: id,
    displayName: id,
    settings: { folderDescription: null }
  }
  return kind === 'prompt'
    ? {
        ...baseFolder,
        kind,
        statusFolders: createPromptStatusFolderLayouts({
          categoryOrders: { [PromptStatusFolderId.Active]: categoryOrder }
        })
      }
    : { ...baseFolder, kind, categoryOrder }
}

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

  it('plans root-folder creation and exact workspace reordering', () => {
    /** Existing sibling root used as the creation predecessor. */
    const sibling = createRootFolder('sibling', 'prompt', null)
    /** Workspace receiving the new root after its sibling. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      entries: [{ kind: 'folder' as const, id: sibling.id }]
    }
    /** Root creation plan shared by renderer and main. */
    const createPlan = planCreatePromptFolderDomainMutation(
      createDomainState({ workspace: [workspace], promptFolder: [sibling] }),
      {
        workspaceId: workspace.id,
        promptFolderId: 'created',
        displayName: ' Created Root ',
        previousEntryId: sibling.id,
        kind: 'prompt'
      }
    )
    expect(Array.isArray(createPlan)).toBe(true)
    if (!Array.isArray(createPlan)) return
    /** Workspace projection after the creation placement recipe. */
    const workspaceAfterCreate = produce(workspace, createPlan[0]!.recipe!)
    expect(workspaceAfterCreate.entries.map((entry) => entry.id)).toEqual([
      sibling.id,
      'created'
    ])
    expect(createPlan[1]).toMatchObject({
      type: 'insert',
      entityType: 'promptFolder',
      id: 'created',
      data: { displayName: 'Created Root', folderName: 'CreatedRoot' }
    })

    /** Workspace containing both roots for the reorder plan. */
    const populatedWorkspace = {
      ...workspace,
      entries: [
        { kind: 'folder' as const, id: sibling.id },
        { kind: 'folder' as const, id: 'created' }
      ]
    }
    /** Created root projected from the insertion plan. */
    const createdRoot = createPlan[1]!.data as PromptFolder
    /** Root reorder plan moving the created root to the beginning. */
    const movePlan = planMovePromptFolderDomainMutation(
      createDomainState({
        workspace: [populatedWorkspace],
        promptFolder: [sibling, createdRoot]
      }),
      { workspaceId: workspace.id, promptFolderId: 'created', previousEntryId: null }
    )
    expect(Array.isArray(movePlan)).toBe(true)
    if (!Array.isArray(movePlan)) return
    expect(
      produce(populatedWorkspace, movePlan[0]!.recipe!).entries.map((entry) => entry.id)
    ).toEqual(['created', sibling.id])
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
    expect(getMarkdownContentCategoryOrder(projectedFolder).categories[1]?.categoryId).toBe(
      'created'
    )
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
    /** Workspace establishing ownership of the deleted category's root. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      entries: [{ kind: 'folder' as const, id: folder.id }]
    }
    /** Planner state containing summary-compatible prompt and template projections. */
    const state = createDomainState({
      workspace: [workspace],
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
      workspaceId: workspace.id,
      modifiedAt: 'renderer-time'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptFolder:root',
      'category:category',
      'prompt:prompt',
      'promptTemplate:template',
      'workspacePromptFolderUiState:workspace:category',
      'categoryDescriptionEditorUiState:workspace:category'
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

  it('maps active category details to the root and preserves inactive root selection', () => {
    /** Root owning the category whose view state is deleted. */
    const folder = createRootFolder('root', 'prompt', 'category')
    /** Workspace establishing root ownership for both deletion plans. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      entries: [{ kind: 'folder' as const, id: folder.id }]
    }
    /** Existing root state whose expansion fields must survive selection transfer. */
    const rootUiState = {
      workspaceId: workspace.id,
      contentOwnerId: folder.id,
      selectedEntryId: 'existing-root-selection',
      treeIsExpanded: false,
      detailsSectionIsExpanded: true,
      contentSectionIsExpanded: false
    }
    /** Category state selecting its category-only details row. */
    const categoryUiState = {
      workspaceId: workspace.id,
      contentOwnerId: 'category',
      selectedEntryId: 'category-details',
      treeIsExpanded: true,
      detailsSectionIsExpanded: false,
      contentSectionIsExpanded: true
    }
    /** Active workspace navigation pointing at the deleted category owner. */
    const activeWorkspaceUiState = {
      workspaceId: workspace.id,
      selectedScreen: 'prompt-folders' as const,
      selectedScreenData: { promptFolderId: folder.id, contentOwnerId: 'category' },
      lastPromptFolderId: folder.id
    }
    /** Shared planner state containing active split UI-state records. */
    const activeState = createDomainState({
      workspace: [workspace],
      promptFolder: [folder],
      category: [{ id: 'category', displayName: 'Category', description: null }],
      workspaceUiState: [activeWorkspaceUiState],
      workspacePromptFolderUiState: [rootUiState, categoryUiState]
    })
    /** Active-category deletion plan containing workspace and root selection updates. */
    const activePlan = planDeleteCategoryDomainMutation(activeState, {
      categoryId: 'category',
      promptFolderId: folder.id,
      workspaceId: workspace.id,
      modifiedAt: 'renderer-time'
    })
    expect(Array.isArray(activePlan)).toBe(true)
    if (!Array.isArray(activePlan)) return
    /** Root UI-state update selected from the complete deletion plan. */
    const rootUpdate = activePlan.find(
      (change) =>
        change.type === 'update' &&
        change.entityType === 'workspacePromptFolderUiState' &&
        change.id === `${workspace.id}:${folder.id}`
    )
    expect(rootUpdate?.type).toBe('update')
    if (rootUpdate?.type !== 'update') return
    expect(produce(rootUiState, rootUpdate.recipe)).toEqual({
      ...rootUiState,
      selectedEntryId: 'root-header'
    })

    /** Inactive navigation already owned by the root and retaining its selection. */
    const inactiveWorkspaceUiState = {
      ...activeWorkspaceUiState,
      selectedScreenData: { promptFolderId: folder.id, contentOwnerId: folder.id }
    }
    /** Inactive-category plan that must not update workspace or root UI state. */
    const inactivePlan = planDeleteCategoryDomainMutation(
      createDomainState({
        workspace: [workspace],
        promptFolder: [folder],
        category: [{ id: 'category', displayName: 'Category', description: null }],
        workspaceUiState: [inactiveWorkspaceUiState],
        workspacePromptFolderUiState: [rootUiState, categoryUiState]
      }),
      {
        categoryId: 'category',
        promptFolderId: folder.id,
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
            change.entityType === 'workspacePromptFolderUiState')
      )
    ).toBe(false)
  })

  it('plans category rename and group reordering', () => {
    /** Root containing two categorized groups. */
    const folder = createRootFolder('root', 'prompt', 'category-a')
    getMarkdownContentCategoryOrder(folder).categories.push({
      categoryId: 'category-b',
      entries: []
    })
    /** Categories participating in rename collision validation. */
    const categories = [
      { id: 'category-a', displayName: 'A', description: null },
      { id: 'category-b', displayName: 'B', description: null }
    ]
    /** Shared category rename plan. */
    const renamePlan = planRenameCategoryDomainMutation(
      createDomainState({ promptFolder: [folder], category: categories }),
      { categoryId: 'category-b', displayName: ' Renamed ' }
    )
    expect(Array.isArray(renamePlan)).toBe(true)
    if (!Array.isArray(renamePlan)) return
    expect(produce(categories[1]!, renamePlan[0]!.recipe!).displayName).toBe('Renamed')

    /** Shared category reorder plan moving B before A. */
    const movePlan = planMoveCategoryDomainMutation(
      createDomainState({ promptFolder: [folder], category: categories }),
      {
        promptFolderId: folder.id,
        statusFolderId: PromptStatusFolderId.Active,
        categoryId: 'category-b',
        previousCategoryId: null
      }
    )
    expect(Array.isArray(movePlan)).toBe(true)
    if (!Array.isArray(movePlan)) return
    expect(
      getMarkdownContentCategoryOrder(produce(folder, movePlan[0]!.recipe!)).categories.map(
        (group) => group.categoryId
      )
    ).toEqual([null, 'category-b', 'category-a'])

    /** Template root proving status-free roots use the same category reorder planner. */
    const templateFolder = createRootFolder('templates', 'template', 'category-a')
    getMarkdownContentCategoryOrder(templateFolder).categories.push({
      categoryId: 'category-b',
      entries: []
    })
    /** Shared template category reorder plan using its null status-folder identity. */
    const templateMovePlan = planMoveCategoryDomainMutation(
      createDomainState({ promptFolder: [templateFolder], category: categories }),
      {
        promptFolderId: templateFolder.id,
        statusFolderId: null,
        categoryId: 'category-b',
        previousCategoryId: null
      }
    )
    expect(Array.isArray(templateMovePlan)).toBe(true)
    if (!Array.isArray(templateMovePlan)) return
    expect(
      getMarkdownContentCategoryOrder(
        produce(templateFolder, templateMovePlan[0]!.recipe!)
      ).categories.map((group) => group.categoryId)
    ).toEqual([null, 'category-b', 'category-a'])
  })

  it('plans category descriptions and normalized system settings as single targets', () => {
    /** Category receiving a paced description replacement. */
    const category = { id: 'category', displayName: 'Category', description: null }
    /** Loaded singleton settings receiving a paced replacement. */
    const settings = {
      promptFontSize: 16,
      promptEditorMinLines: 2,
      promptEditorMaxLines: 35,
      showLineNumbers: true
    }
    /** Single-category description plan. */
    const categoryPlan = planSetCategoryDescriptionDomainMutation(
      createDomainState({ category: [category] }),
      { categoryId: category.id, description: 'Updated description.' }
    )
    expect(Array.isArray(categoryPlan)).toBe(true)
    if (!Array.isArray(categoryPlan)) return
    expect(categoryPlan).toHaveLength(1)
    expect(produce(category, categoryPlan[0]!.recipe!).description).toBe('Updated description.')

    /** Single-settings plan normalized through the shared bounds. */
    const settingsPlan = planSetSystemSettingsDomainMutation(
      createDomainState({ systemSettings: [settings] }),
      {
        promptFontSize: 100,
        promptEditorMinLines: 3,
        promptEditorMaxLines: 30,
        showLineNumbers: false
      }
    )
    expect(Array.isArray(settingsPlan)).toBe(true)
    if (!Array.isArray(settingsPlan)) return
    expect(settingsPlan).toHaveLength(1)
    expect(produce(settings, settingsPlan[0]!.recipe!)).toEqual({
      promptFontSize: 32,
      promptEditorMinLines: 3,
      promptEditorMaxLines: 30,
      showLineNumbers: false
    })
  })

  it('plans prompt and template creation with synchronized root placement', () => {
    /** Prompt root receiving one newly created prompt. */
    const promptRoot = createRootFolder('prompts', 'prompt', null)
    /** Template root receiving one newly created template. */
    const templateRoot = createRootFolder('templates', 'template', null)
    /** Shared prompt creation plan. */
    const promptPlan = planCreatePromptDomainMutation(
      createDomainState({ promptFolder: [promptRoot] }),
      {
        promptFolderId: promptRoot.id,
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
        produce(promptRoot, promptPlan[0]!.recipe!)
      ).categories[0]?.entries
    ).toEqual([{ kind: 'prompt', id: 'prompt' }])

    /** Shared template creation plan. */
    const templatePlan = planCreatePromptTemplateDomainMutation(
      createDomainState({ promptFolder: [templateRoot] }),
      {
        promptFolderId: templateRoot.id,
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
    const promptRoot = createRootFolder('prompts', 'prompt', null)
    getMarkdownContentCategoryOrder(promptRoot).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Template root owning the full template update target. */
    const templateRoot = createRootFolder('templates', 'template', null)
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
      createDomainState({ promptFolder: [promptRoot], prompt: [prompt] }),
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
    expect(produce(prompt, promptPlan[0]!.recipe!)).toEqual({
      ...prompt,
      title: 'Updated Prompt',
      modifiedAt: '2026-08-30T12:00:00Z',
      promptText: 'Updated prompt.',
      templates: [{ id: 'template' }]
    })

    /** Shared prompt-template autosave plan. */
    const templatePlan = planPromptTemplateUpdate(
      createDomainState({ promptFolder: [templateRoot], promptTemplate: [template] }),
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
    expect(produce(template, templatePlan[0]!.recipe!)).toEqual({
      ...template,
      title: 'Updated Template',
      modifiedAt: '2026-08-30T12:00:00Z',
      templateText: 'Updated template.'
    })
  })

  it('plans prompt completion from a summary projection', () => {
    /** Active prompt root containing the status target. */
    const folder = createRootFolder('root', 'prompt', null)
    getMarkdownContentCategoryOrder(folder).categories[0]!.entries.push({
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
    const plan = planSetPromptStatusDomainMutation(
      createDomainState({ promptFolder: [folder], prompt: [prompt] }),
      {
        sourcePromptFolderId: folder.id,
        destinationPromptFolderId: folder.id,
        promptId: prompt.id,
        status: PromptStatus.Completed,
        categoryOrderPlacement: { categoryId: null, previousEntryId: null },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Root projection after completion ownership changes. */
    const completedFolder = produce(folder, plan[0]!.recipe!)
    /** Prompt projection after completion fields are applied. */
    const completedPrompt = produce(prompt, plan[1]!.recipe!)
    expect(
      completedFolder.statusFolders[PromptStatusFolderId.Completed].promptIds
    ).toEqual([prompt.id])
    expect(
      completedFolder.statusFolders[PromptStatusFolderId.Active].categoryOrder
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
    const folder = createRootFolder('root', 'prompt', null)
    folder.statusFolders[PromptStatusFolderId.Completed].promptIds = ['prompt']
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
    const plan = planSetPromptStatusDomainMutation(
      createDomainState({ promptFolder: [folder], prompt: [prompt] }),
      {
        sourcePromptFolderId: folder.id,
        destinationPromptFolderId: folder.id,
        promptId: prompt.id,
        status: PromptStatus.Archived,
        categoryOrderPlacement: { categoryId: null, previousEntryId: null },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )

    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Root projection after ownership moves from Completed to Archived. */
    const archivedFolder = produce(folder, plan[0]!.recipe!)
    /** Prompt projection after Archived replaces its finalization timestamp. */
    const archivedPrompt = produce(prompt, plan[1]!.recipe!)
    expect(archivedFolder.statusFolders[PromptStatusFolderId.Completed].promptIds).toEqual([])
    expect(archivedFolder.statusFolders[PromptStatusFolderId.Archived].promptIds).toEqual([
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
    const folder = createRootFolder('root', 'prompt', null)
    getMarkdownContentCategoryOrder(folder).categories[0]!.entries.push({
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
    const plan = planSetPromptStatusDomainMutation(
      createDomainState({ promptFolder: [folder], prompt: [prompt] }),
      {
        sourcePromptFolderId: folder.id,
        destinationPromptFolderId: folder.id,
        promptId: prompt.id,
        status: PromptStatus.InProgress,
        categoryOrderPlacement: { categoryId: null, previousEntryId: null },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )

    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'prompt:prompt'
    ])
    expect(produce(prompt, plan[0]!.recipe!)).toMatchObject({
      status: PromptStatus.InProgress,
      modifiedAt: '2026-08-30T12:00:00Z'
    })
  })

  it('transfers ordering when the root changes within one status folder', () => {
    /** Source root owning the prompt in its Active status folder. */
    const source = createRootFolder('source', 'prompt', null)
    getMarkdownContentCategoryOrder(source).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Destination root receiving the prompt in its own Active status folder. */
    const destination = createRootFolder('destination', 'prompt', null)
    /** Todo prompt changing roots while remaining inside the Active status-folder identity. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      status: PromptStatus.Todo
    }
    /** Shared status plan expected to transfer both root orderings and update the prompt. */
    const plan = planSetPromptStatusDomainMutation(
      createDomainState({ promptFolder: [source, destination], prompt: [prompt] }),
      {
        sourcePromptFolderId: source.id,
        destinationPromptFolderId: destination.id,
        promptId: prompt.id,
        status: PromptStatus.InProgress,
        categoryOrderPlacement: { categoryId: null, previousEntryId: null },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )

    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptFolder:source',
      'promptFolder:destination',
      'prompt:prompt'
    ])
    /** Source root after its Active ordering loses the prompt. */
    const projectedSource = produce(source, plan[0]!.recipe!)
    /** Destination root after its Active ordering receives the prompt. */
    const projectedDestination = produce(destination, plan[1]!.recipe!)
    expect(getMarkdownContentCategoryOrder(projectedSource).categories[0]?.entries).toEqual([])
    expect(getMarkdownContentCategoryOrder(projectedDestination).categories[0]?.entries).toEqual([
      { kind: 'prompt', id: prompt.id }
    ])
  })

  it('transfers prompt status ownership across root folders', () => {
    /** Source root currently owning the active prompt. */
    const source = createRootFolder('source', 'prompt', null)
    getMarkdownContentCategoryOrder(source).categories[0]!.entries.push({
      kind: 'prompt',
      id: 'prompt'
    })
    /** Destination root receiving the completed prompt. */
    const destination = createRootFolder('destination', 'prompt', null)
    /** Summary-compatible prompt selected for cross-root completion. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      modifiedAt: 'old',
      status: PromptStatus.Todo
    }
    /** Shared status plan transferring ownership into the destination Completed hierarchy. */
    const plan = planSetPromptStatusDomainMutation(
      createDomainState({ promptFolder: [source, destination], prompt: [prompt] }),
      {
        sourcePromptFolderId: source.id,
        destinationPromptFolderId: destination.id,
        promptId: prompt.id,
        status: PromptStatus.Completed,
        categoryOrderPlacement: { categoryId: null, previousEntryId: null },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    expect(plan.map(({ entityType, id }) => `${entityType}:${id}`)).toEqual([
      'promptFolder:source',
      'promptFolder:destination',
      'prompt:prompt'
    ])
    /** Source projection after active ownership is removed. */
    const projectedSource = produce(source, plan[0]!.recipe!)
    /** Destination projection after completed ownership is inserted. */
    const projectedDestination = produce(destination, plan[1]!.recipe!)
    expect(getMarkdownContentCategoryOrder(projectedSource).categories[0]?.entries).toEqual([])
    expect(
      projectedDestination.statusFolders[PromptStatusFolderId.Completed].promptIds
    ).toEqual([prompt.id])
  })

  it('clears stale category metadata when restoring a prompt to Uncategorized', () => {
    /** Root whose completed prompt retains its former category metadata. */
    const folder = createRootFolder('root', 'prompt', 'category')
    folder.statusFolders[PromptStatusFolderId.Completed].promptIds = ['prompt']
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
    const plan = planSetPromptStatusDomainMutation(
      createDomainState({ promptFolder: [folder], prompt: [prompt] }),
      {
        sourcePromptFolderId: folder.id,
        destinationPromptFolderId: folder.id,
        promptId: prompt.id,
        status: PromptStatus.Todo,
        categoryOrderPlacement: { categoryId: null, previousEntryId: null },
        modifiedAt: '2026-08-30T12:00:00Z'
      }
    )
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Restored prompt projection after applying the shared recipe. */
    const restoredPrompt = produce(prompt, plan[1]!.recipe!)
    /** Root projection after restoring Active-tree ownership. */
    const restoredFolder = produce(folder, plan[0]!.recipe!)
    expect(restoredPrompt).not.toHaveProperty('category')
    expect(restoredPrompt).not.toHaveProperty('finalizedAt')
    expect(
      restoredFolder.statusFolders[PromptStatusFolderId.Active].categoryOrder
        .categories[0]?.entries
    ).toEqual([
      { kind: 'prompt', id: prompt.id }
    ])
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
    getMarkdownContentCategoryOrder(source).categories[0]!.entries.push({
      kind: 'template',
      id: 'moving'
    })
    /** Destination template root already containing the preferred fallback title. */
    const destination = createRootFolder('destination', 'template', null)
    getMarkdownContentCategoryOrder(destination).categories[0]!.entries.push({
      kind: 'template',
      id: 'existing'
    })
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
