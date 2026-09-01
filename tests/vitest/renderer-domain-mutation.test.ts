import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import {
  SYSTEM_SETTINGS_CLIENT_STATE_ID,
  systemSettingsClientStateCollection
} from '@renderer/data/Collections/SystemSettingsClientStateCollection'
import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '@renderer/data/IpcFramework/RendererDomainMutation'
import { submitAllPacedUpdateTransactionsAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
import {
  setPromptTemplates,
  setPromptText,
  setPromptTitle
} from '@renderer/data/UiState/PromptClientStateMutations.svelte.ts'
import {
  setPromptTemplateText,
  setPromptTemplateTitle
} from '@renderer/data/UiState/PromptTemplateClientStateMutations.svelte.ts'
import { mutateSystemSettingsClientStateWithAutosave } from '@renderer/data/UiState/SystemSettingsAutosave.svelte.ts'
import type {
  DomainExpectedTargetSelector,
  DomainPlanner
} from '@shared/DomainChanges'
import type {
  UpdatePromptDomainCommand,
  UpdatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import { createPromptFull, PromptStatus } from '@shared/Prompt'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { DEFAULT_SYSTEM_SETTINGS, SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import {
  clearPromptEditorMeasuredHeight,
  lookupPromptEditorMeasuredHeight,
  recordPromptEditorMeasuredHeight
} from '@renderer/data/UiState/PromptEditorUiCache.svelte.ts'

/** Stable category and local-state ID used by executable renderer framework tests. */
const CATEGORY_ID = 'renderer-domain-framework'
/** Stable prompt ID used to verify authoritative editor cache reconciliation. */
const PROMPT_ID = 'renderer-domain-prompt'
/** Stable template ID used by autosave and reconciliation framework tests. */
const TEMPLATE_ID = 'renderer-domain-template'
/** Prompt-folder ID establishing prompt ownership for shared update planning. */
const PROMPT_FOLDER_ID = 'renderer-domain-prompt-folder'
/** Template-folder ID establishing template ownership for shared update planning. */
const TEMPLATE_FOLDER_ID = 'renderer-domain-template-folder'
/** Absent category-editor UI-state ID used to verify optional renderer deletion. */
const OPTIONAL_UI_STATE_ID = 'renderer-domain-workspace:absent-category'
/** Editor measurement reused for prompt and template autosave assertions. */
const EDITOR_MEASUREMENT = {
  measuredHeightPx: 100,
  widthPx: 500,
  devicePixelRatio: 1
}

/** Command that assigns one category display name. */
type RenameTestCommand = { displayName: string }

/** Shared test planner producing one recipe-based category update. */
const planRenameCategory: DomainPlanner<RenameTestCommand> = (_state, command) => [
  {
    type: 'update',
    entityType: 'category',
    id: CATEGORY_ID,
    recipe: (draft) => {
      draft.displayName = command.displayName
    }
  }
]

/** Shared test planner deleting the category while its optimistic record disappears. */
const planDeleteCategory: DomainPlanner<Record<string, never>> = () => [
  { type: 'delete', entityType: 'category', id: CATEGORY_ID }
]

/** Shared test planner deleting an optional UI-state record that is not loaded. */
const planDeleteAbsentUiState: DomainPlanner<Record<string, never>> = () => [
  {
    type: 'delete',
    entityType: 'categoryDescriptionEditorUiState',
    id: OPTIONAL_UI_STATE_ID
  }
]

/** Creates one generic successful category snapshot response. */
const createSuccessResponse = (revision: number, displayName: string) => ({
  success: true as const,
  payload: {
    snapshots: [
      {
        entityType: 'category' as const,
        id: CATEGORY_ID,
        revision,
        data: { id: CATEGORY_ID, displayName, description: null }
      }
    ]
  }
})

/** Runs one category mutation with a renderer-only edited-state change. */
const runCategoryDomainMutation = async (
  displayName: string,
  selectExpectedTargets?: DomainExpectedTargetSelector
): Promise<void> =>
  await runImmediateRendererDomainMutation({
    mutation: { command: { displayName }, plan: planRenameCategory, selectExpectedTargets },
    ipc: { channel: 'test-renderer-domain' },
    renderer: {
      mutate: ({ collections }) => {
        collections.promptClientState.update(CATEGORY_ID, (draft) => {
          draft.isEdited = true
        })
      },
      clientStateCollections: [promptClientStateCollection]
    }
  })

/** Applies one paced category rename through the generic renderer domain framework. */
const mutatePacedCategoryDomainMutation = (
  displayName: string,
  debounceMs: number,
  validateBeforeEnqueue?: () => boolean
): void =>
  mutatePacedRendererDomainMutation({
    mutation: { command: { displayName }, plan: planRenameCategory },
    ipc: { channel: 'test-renderer-domain-paced' },
    renderer: {
      mutate: ({ collections }) => {
        collections.promptClientState.update(CATEGORY_ID, (draft) => {
          draft.isEdited = true
        })
      },
      clientStateCollections: [promptClientStateCollection]
    },
    pacing: {
      target: { entityType: 'category', id: CATEGORY_ID },
      debounceMs,
      validateBeforeEnqueue
    }
  })

describe('renderer domain mutation framework', () => {
  beforeEach(() => {
    categoryCollection.utils.deleteAuthoritative(CATEGORY_ID)
    if (promptClientStateCollection.has(CATEGORY_ID)) {
      promptClientStateCollection.delete(CATEGORY_ID)
    }
    if (promptClientStateCollection.has(PROMPT_ID)) {
      promptClientStateCollection.delete(PROMPT_ID)
    }
    if (promptTemplateClientStateCollection.has(TEMPLATE_ID)) {
      promptTemplateClientStateCollection.delete(TEMPLATE_ID)
    }
    if (systemSettingsClientStateCollection.has(SYSTEM_SETTINGS_CLIENT_STATE_ID)) {
      systemSettingsClientStateCollection.delete(SYSTEM_SETTINGS_CLIENT_STATE_ID)
    }
    promptCollection.utils.deleteAuthoritative(PROMPT_ID)
    promptTemplateCollection.utils.deleteAuthoritative(TEMPLATE_ID)
    promptFolderCollection.utils.deleteAuthoritative(PROMPT_FOLDER_ID)
    promptFolderCollection.utils.deleteAuthoritative(TEMPLATE_FOLDER_ID)
    systemSettingsCollection.utils.deleteAuthoritative(SYSTEM_SETTINGS_ID)
    clearPromptEditorMeasuredHeight(PROMPT_ID)
    clearPromptEditorMeasuredHeight(TEMPLATE_ID)
    categoryCollection.utils.upsertAuthoritative({
      id: CATEGORY_ID,
      revision: 1,
      data: { id: CATEGORY_ID, displayName: 'Initial', description: null }
    })
    promptClientStateCollection.insert({ id: CATEGORY_ID, isEdited: false })
  })

  afterEach(async () => {
    await submitAllPacedUpdateTransactionsAndWait()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('accepts renderer-only state after success and sends current target revisions', async () => {
    /** IPC invoke spy returning authoritative success. */
    const invoke = vi.fn().mockResolvedValue(createSuccessResponse(2, 'Successful'))
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runCategoryDomainMutation('Successful')

    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Successful')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)
    expect(invoke).toHaveBeenCalledWith(
      'test-renderer-domain',
      expect.objectContaining({
        payload: expect.objectContaining({
          expectations: [
            {
              entityType: 'category',
              id: CATEGORY_ID,
              expected: 'revision',
              revision: 1
            }
          ]
        })
      })
    )
  })

  it('builds delete expectations from authoritative presence after optimistic removal', async () => {
    /** IPC invoke spy returning authoritative category deletion. */
    const invoke = vi.fn().mockResolvedValue({
      success: true,
      payload: {
        snapshots: [{ entityType: 'category', id: CATEGORY_ID, deleted: true }]
      }
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runImmediateRendererDomainMutation({
      mutation: { command: {}, plan: planDeleteCategory },
      ipc: { channel: 'test-authoritative-delete-expectation' },
      renderer: {}
    })

    expect(invoke).toHaveBeenCalledWith(
      'test-authoritative-delete-expectation',
      expect.objectContaining({
        payload: expect.objectContaining({
          expectations: [
            {
              entityType: 'category',
              id: CATEGORY_ID,
              expected: 'revision',
              revision: 1
            }
          ]
        })
      })
    )
  })

  it('skips absent renderer records for optional domain deletes', async () => {
    /** IPC invoke spy returning authoritative absence for the optional record. */
    const invoke = vi.fn().mockResolvedValue({
      success: true,
      payload: {
        snapshots: [
          {
            entityType: 'categoryDescriptionEditorUiState',
            id: OPTIONAL_UI_STATE_ID,
            deleted: true
          }
        ]
      }
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runImmediateRendererDomainMutation({
      mutation: {
        command: {},
        plan: planDeleteAbsentUiState,
        selectExpectedTargets: () => []
      },
      ipc: { channel: 'test-optional-renderer-delete' },
      renderer: {}
    })

    expect(invoke).not.toHaveBeenCalled()
  })

  it('applies conflict truth and rolls back renderer-only state', async () => {
    /** IPC invoke spy returning authoritative conflict truth. */
    const invoke = vi.fn().mockResolvedValue({
      success: false,
      conflict: true,
      payload: createSuccessResponse(2, 'Server').payload
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await expect(runCategoryDomainMutation('Optimistic')).rejects.toThrow(
      'Domain mutation conflict on test-renderer-domain'
    )
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Server')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(false)
  })

  it('clears cached editor measurements when authoritative prompt text differs', async () => {
    promptCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 1,
      data: createPromptFull({
        id: PROMPT_ID,
        title: 'Prompt',
        fallbackTitle: '',
        createdAt: '2026-08-30T10:00:00Z',
        modifiedAt: '2026-08-30T11:00:00Z',
        promptText: 'Local text.',
        status: PromptStatus.Todo
      })
    })
    recordPromptEditorMeasuredHeight(
      PROMPT_ID,
      { measuredHeightPx: 100, widthPx: 500, devicePixelRatio: 1 },
      true
    )
    /** Prompt update planner used to route one authoritative text snapshot. */
    const planPromptText: DomainPlanner<{ promptText: string }> = (_state, command) => [
      {
        type: 'update',
        entityType: 'prompt',
        id: PROMPT_ID,
        recipe: (draft) => {
          Object.assign(draft, { promptText: command.promptText })
        }
      }
    ]
    /** IPC response whose authoritative text differs from the optimistic command. */
    const invoke = vi.fn().mockResolvedValue({
      success: true,
      payload: {
        snapshots: [
          {
            entityType: 'prompt',
            id: PROMPT_ID,
            revision: 2,
            data: {
              id: PROMPT_ID,
              title: 'Prompt',
              fallbackTitle: '',
              createdAt: '2026-08-30T10:00:00Z',
              modifiedAt: '2026-08-30T12:00:00Z',
              promptText: 'Server text.',
              status: PromptStatus.Todo
            }
          }
        ]
      }
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runImmediateRendererDomainMutation({
      mutation: { command: { promptText: 'Optimistic text.' }, plan: planPromptText },
      ipc: { channel: 'test-renderer-prompt-reconcile' },
      renderer: {}
    })

    expect(lookupPromptEditorMeasuredHeight(PROMPT_ID, 500, 1)).toBeNull()
    expect(promptCollection.get(PROMPT_ID)).toMatchObject({ promptText: 'Server text.' })
  })

  it('merges prompt and template editor fields into their latest paced commands', async () => {
    promptCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 1,
      data: createPromptFull({
        id: PROMPT_ID,
        title: 'Original Prompt',
        fallbackTitle: '',
        createdAt: '2026-08-30T10:00:00Z',
        modifiedAt: '2026-08-30T11:00:00Z',
        promptText: 'Original prompt text.',
        status: PromptStatus.Todo
      })
    })
    promptTemplateCollection.utils.upsertAuthoritative({
      id: TEMPLATE_ID,
      revision: 1,
      data: createPromptTemplateFull({
        id: TEMPLATE_ID,
        title: 'Original Template',
        fallbackTitle: '',
        createdAt: '2026-08-30T10:00:00Z',
        modifiedAt: '2026-08-30T11:00:00Z',
        templateText: 'Original template text.'
      })
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: PROMPT_FOLDER_ID,
      revision: 1,
      data: {
        id: PROMPT_FOLDER_ID,
        kind: 'prompt',
        folderName: 'Prompts',
        displayName: 'Prompts',
        completedPromptIds: [],
        categoryOrder: {
          categories: [{ categoryId: null, entries: [{ kind: 'prompt', id: PROMPT_ID }] }]
        },
        settings: { folderDescription: null }
      }
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: TEMPLATE_FOLDER_ID,
      revision: 1,
      data: {
        id: TEMPLATE_FOLDER_ID,
        kind: 'template',
        folderName: 'Templates',
        displayName: 'Templates',
        completedPromptIds: [],
        categoryOrder: {
          categories: [
            { categoryId: null, entries: [{ kind: 'template', id: TEMPLATE_ID }] }
          ]
        },
        settings: { folderDescription: null }
      }
    })
    promptClientStateCollection.insert({ id: PROMPT_ID, isEdited: false })
    promptTemplateClientStateCollection.insert({ id: TEMPLATE_ID, isEdited: false })
    /** IPC implementation echoing each complete editor replacement as authoritative truth. */
    const invoke = vi.fn(
      async (
        channel: string,
        request: { payload: { command: UpdatePromptDomainCommand | UpdatePromptTemplateDomainCommand } }
      ) => {
        if (channel === 'update-prompt') {
          /** Latest merged prompt command persisted by the paced transaction. */
          const command = request.payload.command as UpdatePromptDomainCommand
          return {
            success: true,
            payload: {
              snapshots: [
                {
                  entityType: 'prompt',
                  id: PROMPT_ID,
                  revision: 2,
                  data: {
                    id: PROMPT_ID,
                    title: command.title,
                    fallbackTitle: command.fallbackTitle,
                    createdAt: '2026-08-30T10:00:00Z',
                    modifiedAt: command.modifiedAt,
                    promptText: command.promptText,
                    ...(command.templates !== undefined ? { templates: command.templates } : {}),
                    status: PromptStatus.Todo
                  }
                }
              ]
            }
          }
        }
        /** Latest merged template command persisted by the paced transaction. */
        const command = request.payload.command as UpdatePromptTemplateDomainCommand
        return {
          success: true,
          payload: {
            snapshots: [
              {
                entityType: 'promptTemplate',
                id: TEMPLATE_ID,
                revision: 2,
                data: {
                  id: TEMPLATE_ID,
                  title: command.title,
                  fallbackTitle: command.fallbackTitle,
                  createdAt: '2026-08-30T10:00:00Z',
                  modifiedAt: command.modifiedAt,
                  templateText: command.templateText
                }
              }
            ]
          }
        }
      }
    )
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    setPromptTitle(PROMPT_ID, 'Updated Prompt')
    setPromptText(PROMPT_ID, 'Updated prompt text.', EDITOR_MEASUREMENT)
    setPromptTemplates(PROMPT_ID, [{ id: TEMPLATE_ID }])
    setPromptTemplateTitle(TEMPLATE_ID, 'Updated Template')
    setPromptTemplateText(TEMPLATE_ID, 'Updated template text.', EDITOR_MEASUREMENT)
    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(2)
    expect(invoke).toHaveBeenCalledWith(
      'update-prompt',
      expect.objectContaining({
        payload: expect.objectContaining({
          command: expect.objectContaining({
            contentId: PROMPT_ID,
            title: 'Updated Prompt',
            promptText: 'Updated prompt text.',
            templates: [{ id: TEMPLATE_ID }]
          }),
          expectations: [
            {
              entityType: 'prompt',
              id: PROMPT_ID,
              expected: 'revision',
              revision: 1
            }
          ]
        })
      })
    )
    expect(invoke).toHaveBeenCalledWith(
      'update-prompt-template',
      expect.objectContaining({
        payload: expect.objectContaining({
          command: expect.objectContaining({
            contentId: TEMPLATE_ID,
            title: 'Updated Template',
            templateText: 'Updated template text.'
          }),
          expectations: [
            {
              entityType: 'promptTemplate',
              id: TEMPLATE_ID,
              expected: 'revision',
              revision: 1
            }
          ]
        })
      })
    )
    expect(promptClientStateCollection.get(PROMPT_ID)?.isEdited).toBe(true)
    expect(promptTemplateClientStateCollection.get(TEMPLATE_ID)?.isEdited).toBe(true)
    expect(lookupPromptEditorMeasuredHeight(PROMPT_ID, 500, 1)).toBe(100)
    expect(lookupPromptEditorMeasuredHeight(TEMPLATE_ID, 500, 1)).toBe(100)
  })

  it('clears cached editor measurements when authoritative template text differs', async () => {
    promptTemplateCollection.utils.upsertAuthoritative({
      id: TEMPLATE_ID,
      revision: 1,
      data: createPromptTemplateFull({
        id: TEMPLATE_ID,
        title: 'Template',
        fallbackTitle: '',
        createdAt: '2026-08-30T10:00:00Z',
        modifiedAt: '2026-08-30T11:00:00Z',
        templateText: 'Local text.'
      })
    })
    recordPromptEditorMeasuredHeight(TEMPLATE_ID, EDITOR_MEASUREMENT, true)
    /** Template update planner used to route one authoritative text snapshot. */
    const planTemplateText: DomainPlanner<{ templateText: string }> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptTemplate',
        id: TEMPLATE_ID,
        recipe: (draft) => {
          Object.assign(draft, { templateText: command.templateText })
        }
      }
    ]
    /** IPC response whose authoritative template text differs from the optimistic command. */
    const invoke = vi.fn().mockResolvedValue({
      success: true,
      payload: {
        snapshots: [
          {
            entityType: 'promptTemplate',
            id: TEMPLATE_ID,
            revision: 2,
            data: {
              id: TEMPLATE_ID,
              title: 'Template',
              fallbackTitle: '',
              createdAt: '2026-08-30T10:00:00Z',
              modifiedAt: '2026-08-30T12:00:00Z',
              templateText: 'Server text.'
            }
          }
        ]
      }
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runImmediateRendererDomainMutation({
      mutation: { command: { templateText: 'Optimistic text.' }, plan: planTemplateText },
      ipc: { channel: 'test-renderer-template-reconcile' },
      renderer: {}
    })

    expect(lookupPromptEditorMeasuredHeight(TEMPLATE_ID, 500, 1)).toBeNull()
    expect(promptTemplateCollection.get(TEMPLATE_ID)).toMatchObject({
      templateText: 'Server text.'
    })
  })

  it('persists the latest valid system-settings form through one paced command', async () => {
    systemSettingsCollection.utils.upsertAuthoritative({
      id: SYSTEM_SETTINGS_ID,
      revision: 1,
      data: { ...DEFAULT_SYSTEM_SETTINGS }
    })
    systemSettingsClientStateCollection.insert({
      id: SYSTEM_SETTINGS_CLIENT_STATE_ID,
      promptFontSizeInput: '16',
      promptEditorMinLinesInput: '2',
      promptEditorMaxLinesInput: '35',
      showLineNumbers: true
    })
    /** IPC implementation returning the latest valid settings command as authoritative truth. */
    const invoke = vi.fn(
      async (_channel: string, request: { payload: { command: typeof DEFAULT_SYSTEM_SETTINGS } }) => ({
        success: true,
        payload: {
          snapshots: [
            {
              entityType: 'systemSettings',
              id: SYSTEM_SETTINGS_ID,
              revision: 2,
              data: request.payload.command
            }
          ]
        }
      })
    )
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutateSystemSettingsClientStateWithAutosave((clientState) => {
      clientState.promptFontSizeInput = 'invalid'
    })
    await submitAllPacedUpdateTransactionsAndWait()
    expect(invoke).not.toHaveBeenCalled()

    mutateSystemSettingsClientStateWithAutosave((clientState) => {
      clientState.promptFontSizeInput = '20'
    })
    mutateSystemSettingsClientStateWithAutosave((clientState) => {
      clientState.showLineNumbers = false
    })
    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith(
      'update-system-settings',
      expect.objectContaining({
        payload: {
          command: {
            promptFontSize: 20,
            promptEditorMinLines: 2,
            promptEditorMaxLines: 35,
            showLineNumbers: false
          },
          expectations: [
            {
              entityType: 'systemSettings',
              id: SYSTEM_SETTINGS_ID,
              expected: 'revision',
              revision: 1
            }
          ]
        }
      })
    )
    expect(systemSettingsCollection.get(SYSTEM_SETTINGS_ID)).toMatchObject({
      promptFontSize: 20,
      promptEditorMinLines: 2,
      promptEditorMaxLines: 35,
      showLineNumbers: false
    })
    expect(systemSettingsClientStateCollection.get(SYSTEM_SETTINGS_CLIENT_STATE_ID)).toMatchObject({
      id: SYSTEM_SETTINGS_CLIENT_STATE_ID,
      promptFontSizeInput: '20',
      promptEditorMinLinesInput: '2',
      promptEditorMaxLinesInput: '35',
      showLineNumbers: false
    })
  })

  it('captures expectations after earlier queued mutations settle', async () => {
    /** Resolver that holds the first IPC response while a second mutation is queued. */
    let releaseFirstResponse: (() => void) | undefined
    /** Promise gate controlling the first queued IPC response. */
    const firstResponseGate = new Promise<void>((resolve) => {
      releaseFirstResponse = resolve
    })
    /** Captured domain request payloads in actual IPC send order. */
    const requests: Array<{ payload: { expectations: Array<{ revision: number }> } }> = []
    /** IPC implementation returning monotonically revised authoritative snapshots. */
    const invoke = vi.fn(async (_channel: string, request: typeof requests[number]) => {
      requests.push(request)
      if (requests.length === 1) {
        await firstResponseGate
        return createSuccessResponse(2, 'First')
      }
      return createSuccessResponse(3, 'Second')
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    /** First immediate mutation currently holding the renderer global queue. */
    const firstMutation = runCategoryDomainMutation('First')
    /** Second immediate mutation queued while the first IPC response is pending. */
    const secondMutation = runCategoryDomainMutation('Second')
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    releaseFirstResponse?.()
    await Promise.all([firstMutation, secondMutation])

    expect(requests.map((request) => request.payload.expectations[0]!.revision)).toEqual([1, 2])
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Second')
  })

  it('uses the registration selector to omit unchecked targets', async () => {
    /** IPC invocation used to inspect the registration-selected expectation set. */
    const invoke = vi.fn().mockResolvedValue(createSuccessResponse(2, 'Unchecked'))
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runCategoryDomainMutation('Unchecked', () => [])

    expect(invoke).toHaveBeenCalledWith(
      'test-renderer-domain',
      expect.objectContaining({
        payload: expect.objectContaining({ expectations: [] })
      })
    )
  })

  it('merges same-target paced edits, resets debounce, and persists only the latest command', async () => {
    vi.useFakeTimers()
    /** IPC invocation returning the authoritative value from the replacement command. */
    const invoke = vi.fn(
      async (_channel: string, request: { payload: { command: RenameTestCommand } }) =>
        createSuccessResponse(2, request.payload.command.displayName)
    )
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('First paced value', 200)
    vi.advanceTimersByTime(150)
    mutatePacedCategoryDomainMutation('Latest paced value', 200)

    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Latest paced value')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)
    vi.advanceTimersByTime(199)
    await Promise.resolve()
    expect(invoke).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith(
      'test-renderer-domain-paced',
      expect.objectContaining({
        payload: expect.objectContaining({
          command: { displayName: 'Latest paced value' },
          expectations: [
            {
              entityType: 'category',
              id: CATEGORY_ID,
              expected: 'revision',
              revision: 1
            }
          ]
        })
      })
    )
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)
  })

  it('keeps an invalid paced domain mutation pending until its latest edit validates', async () => {
    vi.useFakeTimers()
    /** Current validation state read immediately before paced persistence enqueue. */
    let isValid = false
    /** IPC invocation used to prove invalid input is not persisted. */
    const invoke = vi.fn().mockResolvedValue(createSuccessResponse(2, 'Valid'))
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('Invalid', 200, () => isValid)
    vi.advanceTimersByTime(200)
    await submitAllPacedUpdateTransactionsAndWait()
    expect(invoke).not.toHaveBeenCalled()

    isValid = true
    mutatePacedCategoryDomainMutation('Valid', 200, () => isValid)
    vi.advanceTimersByTime(200)
    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ command: { displayName: 'Valid' } })
      })
    )
  })

  it('rejects paced plans that do not modify exactly their declared target', () => {
    /** Empty plan violating the requirement that one authoritative entity be edited. */
    const planNoChanges: DomainPlanner<RenameTestCommand> = () => []
    /** Single change aimed at an entity other than the declared pacing target. */
    const planDifferentTarget: DomainPlanner<RenameTestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'category',
        id: 'different-category',
        recipe: (draft) => {
          draft.displayName = command.displayName
        }
      }
    ]
    /** Two-target plan violating the requirement that exactly one entity be edited. */
    const planMultipleTargets: DomainPlanner<RenameTestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'category',
        id: CATEGORY_ID,
        recipe: (draft) => {
          draft.displayName = command.displayName
        }
      },
      {
        type: 'update',
        entityType: 'category',
        id: 'additional-category',
        recipe: (draft) => {
          draft.displayName = command.displayName
        }
      }
    ]
    /** Shared mutation options used to exercise plan-target validation. */
    const createOptions = (plan: DomainPlanner<RenameTestCommand>) => ({
      mutation: { command: { displayName: 'Rejected' }, plan },
      ipc: { channel: 'test-renderer-domain-paced' },
      renderer: {},
      pacing: {
        target: { entityType: 'category' as const, id: CATEGORY_ID },
        debounceMs: 200
      }
    })

    expect(() => mutatePacedRendererDomainMutation(createOptions(planNoChanges))).toThrow(
      `Paced domain mutation must modify exactly its declared target category:${CATEGORY_ID}`
    )
    expect(() => mutatePacedRendererDomainMutation(createOptions(planDifferentTarget))).toThrow(
      `Paced domain mutation must modify exactly its declared target category:${CATEGORY_ID}`
    )
    expect(() => mutatePacedRendererDomainMutation(createOptions(planMultipleTargets))).toThrow(
      `Paced domain mutation must modify exactly its declared target category:${CATEGORY_ID}`
    )
  })

  it('flushes a matching paced domain mutation before an immediate domain mutation', async () => {
    /** Commands captured in their actual renderer persistence order. */
    const commands: RenameTestCommand[] = []
    /** IPC implementation producing sequential authoritative revisions. */
    const invoke = vi.fn(
      async (_channel: string, request: { payload: { command: RenameTestCommand } }) => {
        commands.push(request.payload.command)
        return createSuccessResponse(commands.length + 1, request.payload.command.displayName)
      }
    )
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('Paced', 10_000)
    await runCategoryDomainMutation('Immediate')

    expect(commands).toEqual([{ displayName: 'Paced' }, { displayName: 'Immediate' }])
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Immediate')
  })

  it('applies paced conflict truth and rolls back merged renderer-only state', async () => {
    /** IPC conflict returning authoritative category truth. */
    const invoke = vi.fn().mockResolvedValue({
      success: false,
      conflict: true,
      payload: createSuccessResponse(2, 'Server').payload
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('First optimistic', 10_000)
    mutatePacedCategoryDomainMutation('Latest optimistic', 10_000)
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Latest optimistic')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)

    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Server')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(false)
  })
})
