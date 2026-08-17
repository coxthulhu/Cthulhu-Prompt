import { useLiveQuery } from '@tanstack/svelte-db'
import { SvelteSet } from 'svelte/reactivity'
import {
  isPromptFull,
  type Prompt,
  PromptStatus,
  type PromptTemplateReference
} from '@shared/Prompt'
import {
  isPromptTemplateFull,
  type PromptTemplate
} from '@shared/PromptTemplate'
import {
  copyPromptFolderSettings,
  createEmptyPromptFolderSettings,
  getCategoryOrderCategoryIds,
  type PromptFolder,
  type PromptFolderSettings,
  type PromptFolderContentKind
} from '@shared/PromptFolder'
import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
import {
  getPromptNavigationContext,
  persistedPromptTreeEntryIdToPromptNavigationRow,
  promptIdToPromptNavigationRow,
  promptNavigationRowToPersistedEntryId,
  type PromptContentRevealScrollType,
  type PromptNavigationRow,
  type PromptNavigationSource,
  type PromptNavigationTarget
} from '@renderer/app/PromptNavigationContext.svelte.ts'
import {
  type PromptDraftRecord,
  promptDraftCollection
} from '@renderer/data/Collections/PromptDraftCollection'
import {
  type PromptFolderDraftRecord,
  promptFolderDraftCollection
} from '@renderer/data/Collections/PromptFolderDraftCollection'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import {
  type PromptTemplateDraftRecord,
  promptTemplateDraftCollection
} from '@renderer/data/Collections/PromptTemplateDraftCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import type { Category } from '@shared/Category'
import { getActiveMarkdownContentIds } from '@shared/MarkdownContent'
import { loadPromptFolderInitial } from '@renderer/data/Queries/PromptFolderQuery'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import { deletePrompt, movePrompt, setPromptStatus } from '@renderer/data/Mutations/PromptMutations'
import {
  deletePromptTemplate,
  movePromptTemplate
} from '@renderer/data/Mutations/PromptTemplateMutations'
import {
  lookupPromptFolderScrollTop,
  recordPromptFolderScrollTop
} from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
import {
  lookupWorkspacePersistedPromptFolderSettingsSectionExpandedState,
  lookupWorkspacePersistedPromptFolderPromptsSectionExpandedState,
  lookupWorkspacePersistedPromptFolderPromptTreeEntryId,
  setPromptFolderSettingsSectionExpandedStateWithAutosave,
  setPromptFolderPromptsSectionExpandedStateWithAutosave,
  setPromptFolderPromptTreeEntryIdWithAutosave
} from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
import type {
  ScrollToAndTrackRowCentered,
  ScrollToWithinWindowBand,
  VirtualWindowScrollApi,
  VirtualWindowViewportMetrics
} from '../virtualizer/virtualWindowTypes'
import {
  PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
  PROMPT_FOLDER_FIND_TITLE_SECTION_KEY
} from './find/promptFolderFindSectionKeys'
import type { PromptFolderFindItem, PromptFolderFindMatch } from './find/promptFolderFindTypes'
import {
  PROMPT_FOLDER_ROOT_HEADER_ROW_ID,
  promptEditorRowId,
  promptFolderDividerRowId,
  promptFolderEditorRowId
} from './promptFolderRowIds'
import {
  resolvePromptHandleDropMove,
  type PromptHandleDropPayload
} from '../drag-drop/promptHandleDrag'
import type { PromptEditorSizingConfig } from '../prompt-editor/promptEditorSizing'
import { PromptFolderScreenMode } from './promptFolderScreenMode'
import { createBlankPromptInFolder } from './createBlankPromptInFolder'
import { createBlankPromptTemplateInFolder } from './createBlankPromptTemplateInFolder'
import {
  buildPromptFolderScreenRows,
  type PromptFolderDividerTarget,
  type PromptFolderPromptTarget,
  type PromptFolderScreenPromptEditorRow,
  type PromptFolderScreenRow
} from './promptFolderScreenRows'
import { collectCompletedPrompts } from './promptFolderCompletedPrompts'
import { getPromptDisplayTitle as getPromptTitleText } from '@shared/promptFallbackTitle'

export type ActivePromptTreeRow =
  | { kind: 'root-header'; rowOwnerFolderId: string }
  | { kind: 'folder-settings'; rowOwnerFolderId: string }
  | { kind: 'prompt'; rowOwnerFolderId: string; promptId: string }

// Leaves navigated folder headers comfortably below the virtual viewport edge.
const NAVIGATED_FOLDER_TOP_OFFSET_PX = 80

type PromptMetadata = {
  status: PromptStatus
  completedAt: string | null
}

export type MarkdownContentDraftRecord = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  text: string
  templates?: PromptTemplateReference[] | null
  templateName?: string
  templateState?: 'not-selected' | 'no-template' | 'selected'
  isEdited: boolean
}

type PromptFolderScreenControllerOptions = {
  getScreenRootFolderId: () => string
  getScreenMode: () => PromptFolderScreenMode
  onScreenRootFolderSelect: (screenRootFolderId: string) => void
}

export const createPromptFolderScreenController = ({
  getScreenRootFolderId,
  getScreenMode,
  onScreenRootFolderSelect
}: PromptFolderScreenControllerOptions) => {
  const workspaceSelection = getWorkspaceSelectionContext()
  const systemSettings = getSystemSettingsContext()
  const promptNavigation = getPromptNavigationContext()
  const promptEditorSizingConfig: PromptEditorSizingConfig = $derived({
    fontSize: systemSettings.promptFontSize,
    minLines: systemSettings.promptEditorMinLines,
    maxLines: systemSettings.promptEditorMaxLines
  })
  const screenRootFolderId = $derived(getScreenRootFolderId())
  const screenMode = $derived(getScreenMode())
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const workspaceId = $derived(workspaceSelection.selectedWorkspaceId)

  const promptFolderQuery = useLiveQuery(promptFolderCollection) as {
    data: PromptFolder[]
  }
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
  }
  const promptQuery = useLiveQuery(promptCollection) as {
    data: Prompt[]
  }
  const promptTemplateQuery = useLiveQuery(promptTemplateCollection) as {
    data: PromptTemplate[]
  }
  const promptTemplateDraftQuery = useLiveQuery(promptTemplateDraftCollection) as {
    data: PromptTemplateDraftRecord[]
  }
  const promptFolderDraftQuery = useLiveQuery(promptFolderDraftCollection) as {
    data: PromptFolderDraftRecord[]
  }
  const categoryQuery = useLiveQuery(categoryCollection) as { data: Category[] }

  const screenRootFolder = $derived.by(() => {
    for (const candidate of promptFolderQuery.data) {
      if (candidate?.id === screenRootFolderId) {
        return candidate
      }
    }

    return null
  })
  const contentKind = $derived<PromptFolderContentKind>(
    screenRootFolder?.kind ?? 'prompt'
  )
  const isTemplateFolder = $derived(contentKind === 'template')
  const promptDraftById = $derived.by(() => {
    const draftsById: Record<string, PromptDraftRecord> = {}
    for (const draft of promptDraftQuery.data) {
      if (!draft) {
        continue
      }

      draftsById[draft.id] = draft
    }
    return draftsById
  })
  const templateTitleById = $derived.by(() =>
    Object.fromEntries(
      promptTemplateDraftQuery.data.map((template) => [
        template.id,
        getPromptTitleText(template)
      ])
    )
  )
  const promptTemplateTextById = $derived.by<Record<string, string>>(() =>
    Object.fromEntries(
      promptTemplateDraftQuery.data.map((template) => [template.id, template.templateText])
    )
  )
  const contentDraftById = $derived.by<Record<string, MarkdownContentDraftRecord>>(() => {
    if (!isTemplateFolder) {
      return Object.fromEntries(
        Object.values(promptDraftById).map((draft) => {
          // Resolved names drive both the compact label and its additional-template count.
          const templateNames = (draft.templates ?? []).flatMap((template) => {
            const title = templateTitleById[template.id]
            return title === undefined ? [] : [title]
          })
          // Missing references are skipped so the first available template names the selection.
          const templateName = templateNames[0]
          return [
            draft.id,
            {
            id: draft.id,
            title: draft.title,
            fallbackTitle: draft.fallbackTitle,
            modifiedAt: draft.modifiedAt,
            text: draft.promptText,
            ...(draft.templates !== undefined ? { templates: draft.templates } : {}),
            templateName:
              draft.templates === undefined
                ? 'Not Selected'
                : templateName === undefined
                  ? 'No Template'
                  : templateNames.length > 1
                    ? `${templateName} + ${templateNames.length - 1} More`
                    : templateName,
            // Missing template ids use the same indicator treatment as No Template.
            templateState:
              draft.templates === undefined
                ? 'not-selected'
                : templateName === undefined
                  ? 'no-template'
                  : 'selected',
            isEdited: draft.isEdited
            }
          ]
        })
      )
    }

    return Object.fromEntries(
      promptTemplateDraftQuery.data.map((draft) => [
        draft.id,
        {
          id: draft.id,
          title: draft.title,
          fallbackTitle: draft.fallbackTitle,
          modifiedAt: draft.modifiedAt,
          text: draft.templateText,
          isEdited: draft.isEdited
        }
      ])
    )
  })
  const promptById = $derived.by(() => {
    const promptsById: Record<string, Prompt> = {}
    for (const prompt of promptQuery.data) {
      if (!prompt) {
        continue
      }

      promptsById[prompt.id] = prompt
    }
    return promptsById
  })
  const templateById = $derived.by(() =>
    Object.fromEntries(promptTemplateQuery.data.map((template) => [template.id, template]))
  )
  const promptFolderDraftById = $derived.by(() => {
    const draftsById: Record<string, PromptFolderDraftRecord> = {}
    for (const draft of promptFolderDraftQuery.data) {
      if (!draft) {
        continue
      }

      draftsById[draft.id] = draft
    }
    return draftsById
  })
  const screenRootFolderDraft = $derived(promptFolderDraftById[screenRootFolderId] ?? null)
  /** Loaded categories indexed by stable ID. */
  const categoryById = $derived.by<Record<string, Category>>(() =>
    Object.fromEntries(categoryQuery.data.map((category) => [category.id, category]))
  )
  /** Root-owned categories in FolderOrderV2 order. */
  const categories = $derived.by(() =>
    screenRootFolder
      ? getCategoryOrderCategoryIds(screenRootFolder.categoryOrder).flatMap((categoryId) => {
          const category = categoryById[categoryId]
          return category ? [category] : []
        })
      : []
  )
  // Categories belong to the current root while root-folder destinations own themselves.
  const findContainingRootFolderId = (folderId: string): string =>
    categoryById[folderId] ? screenRootFolderId : folderId
  const completedPrompts = $derived.by(() => {
    if (!screenRootFolder || isTemplateFolder) return []

    return collectCompletedPrompts({
      rootFolder: screenRootFolder,
      statusByPromptId: Object.fromEntries(
        promptQuery.data.flatMap((prompt) => (prompt ? [[prompt.id, prompt.status]] : []))
      ),
      completedAtByPromptId: Object.fromEntries(
        promptQuery.data.flatMap((prompt) =>
          prompt ? [[prompt.id, prompt.completedAt ?? null] as const] : []
        )
      )
    })
  })
  const completedPromptCount = $derived(completedPrompts.length)
  const orderedCompletedPromptIds = $derived(completedPrompts.map(({ promptId }) => promptId))
  const completedPromptOwnerByPromptId = $derived.by<Record<string, string>>(() =>
    Object.fromEntries(
      completedPrompts.map(({ ownerFolderId, promptId }) => [promptId, ownerFolderId])
    )
  )
  const emptyFolderSettings = $derived(createEmptyPromptFolderSettings())
  const folderSettingsByFolderId = $derived.by<Record<string, PromptFolderSettings>>(() => {
    const settingsByFolderId: Record<string, PromptFolderSettings> = {}
    for (const folder of promptFolderQuery.data) {
      if (!folder || folder.kind !== contentKind) continue
      const draftSettings = promptFolderDraftById[folder.id]?.settings
      settingsByFolderId[folder.id] = copyPromptFolderSettings(
        draftSettings ?? folder.settings
      )
    }
    return settingsByFolderId
  })
  const folderSettings = $derived(
    folderSettingsByFolderId[screenRootFolderId] ?? emptyFolderSettings
  )
  const folderDisplayName = $derived(screenRootFolder?.displayName ?? 'Prompt Folder')

  let previousPromptFolderLoadKey = $state<string | null>(null)
  let promptFolderLoadRequestId = $state(0)
  let isLoading = $state(true)
  let initialContentRevealRequestId = $state<number | null>(null)
  const LOADING_OVERLAY_FADE_MS = uiAnimationDurationMs.standard
  let shouldShowLoadingOverlay = $state(false)
  const loadingOverlay = createLoadingOverlayState({
    fadeMs: LOADING_OVERLAY_FADE_MS,
    isLoading: () =>
      shouldShowLoadingOverlay &&
      (isLoading ||
        promptNavigation.contentRevealRequests.pending?.id === initialContentRevealRequestId)
  })
  let isCreatingPrompt = $state(false)
  let errorMessage = $state<string | null>(null)

  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  const getRestoredPromptFolderScrollTop = (): number =>
    isCompletedMode ? 0 : (lookupPromptFolderScrollTop(screenRootFolderId) ?? 0)

  let initialPromptFolderScrollTopPx = $state(getRestoredPromptFolderScrollTop())
  let latestCenteredPromptTreeRow = $state<ActivePromptTreeRow | null>(null)
  let scrollTopPx = $state(getRestoredPromptFolderScrollTop())
  const TOP_SCROLL_EPSILON_PX = 1

  let settingsSectionExpandedStates = $state<Record<string, boolean>>({})
  let promptsSectionExpandedStates = $state<Record<string, boolean>>({})

  const getPromptFolderSectionStateKey = (ownerFolderId: string): string =>
    `${workspaceId ?? 'no-workspace'}:${ownerFolderId}:${screenMode}`

  const lookupPersistedSettingsSectionExpandedState = (ownerFolderId: string): boolean => {
    if (isCompletedMode) {
      return false
    }

    if (!workspaceId) {
      return false
    }

    return (
      lookupWorkspacePersistedPromptFolderSettingsSectionExpandedState(
        workspaceId,
        ownerFolderId
      ) ?? false
    )
  }

  const lookupPersistedPromptsSectionExpandedState = (ownerFolderId: string): boolean => {
    if (isCompletedMode) {
      return true
    }

    if (!workspaceId) {
      return true
    }

    return (
      lookupWorkspacePersistedPromptFolderPromptsSectionExpandedState(workspaceId, ownerFolderId) ??
      true
    )
  }

  const getIsPromptsSectionExpanded = (ownerFolderId: string): boolean =>
    promptsSectionExpandedStates[getPromptFolderSectionStateKey(ownerFolderId)] ??
    lookupPersistedPromptsSectionExpandedState(ownerFolderId)

  const getIsSettingsSectionExpanded = (ownerFolderId: string): boolean =>
    settingsSectionExpandedStates[getPromptFolderSectionStateKey(ownerFolderId)] ??
    lookupPersistedSettingsSectionExpandedState(ownerFolderId)

  const promptsSectionExpandedByFolderId = $derived.by<Record<string, boolean>>(() => {
    const expandedByFolderId: Record<string, boolean> = {}
    for (const folder of promptFolderQuery.data) {
      if (!folder) continue
      expandedByFolderId[folder.id] = getIsPromptsSectionExpanded(folder.id)
    }
    for (const category of categories) {
      expandedByFolderId[category.id] = getIsPromptsSectionExpanded(category.id)
    }
    return expandedByFolderId
  })
  const settingsSectionExpandedByFolderId = $derived.by<Record<string, boolean>>(() => {
    const expandedByFolderId: Record<string, boolean> = {}
    for (const folder of promptFolderQuery.data) {
      if (!folder) continue
      expandedByFolderId[folder.id] = getIsSettingsSectionExpanded(folder.id)
    }
    for (const category of categories) {
      expandedByFolderId[category.id] = getIsSettingsSectionExpanded(category.id)
    }
    return expandedByFolderId
  })
  const isPromptsSectionExpanded = $derived(
    promptsSectionExpandedByFolderId[screenRootFolderId] ??
      lookupPersistedPromptsSectionExpandedState(screenRootFolderId)
  )
  const isSettingsSectionExpanded = $derived(
    settingsSectionExpandedByFolderId[screenRootFolderId] ??
      lookupPersistedSettingsSectionExpandedState(screenRootFolderId)
  )

  const activePromptFolderScreenRows = $derived.by((): PromptFolderScreenRow[] => {
    if (!screenRootFolder) return []

    return buildPromptFolderScreenRows({
      rootFolder: screenRootFolder,
      categories,
      promptIds: isTemplateFolder
        ? promptTemplateQuery.data.map((template) => template.id)
        : promptQuery.data.flatMap((prompt) =>
            prompt.status !== PromptStatus.Completed ? [prompt.id] : []
          ),
      isFolderExpanded: (folderId) =>
        folderId === screenRootFolderId || (promptsSectionExpandedByFolderId[folderId] ?? true)
    })
  })
  const activeScreenPromptIds = $derived.by(() =>
    activePromptFolderScreenRows.flatMap((row) =>
      row.kind === 'prompt-editor' ? [row.promptId] : []
    )
  )
  const allActiveScreenPromptIds = $derived.by(() => {
    if (!screenRootFolder) return []

    return buildPromptFolderScreenRows({
      rootFolder: screenRootFolder,
      categories,
      promptIds: isTemplateFolder
        ? promptTemplateQuery.data.map((template) => template.id)
        : promptQuery.data.flatMap((prompt) =>
            prompt.status !== PromptStatus.Completed ? [prompt.id] : []
          ),
      isFolderExpanded: () => true
    }).flatMap((row) => (row.kind === 'prompt-editor' ? [row.promptId] : []))
  })
  const activePromptCount = $derived(allActiveScreenPromptIds.length)
  const screenPromptIds = $derived(
    isCompletedMode ? orderedCompletedPromptIds : activeScreenPromptIds
  )
  const renderedPromptIds = $derived(
    isCompletedMode ? orderedCompletedPromptIds : activeScreenPromptIds
  )
  const promptMetadataByPromptId = $derived.by(() => {
    const metadataById: Record<string, PromptMetadata> = {}
    for (const prompt of promptQuery.data) {
      if (!prompt) continue
      metadataById[prompt.id] = {
        status: prompt.status,
        completedAt: prompt.completedAt ?? null
      }
    }
    if (isTemplateFolder) {
      for (const template of promptTemplateQuery.data) {
        metadataById[template.id] = {
          status: PromptStatus.Todo,
          completedAt: null
        }
      }
    }

    return metadataById
  })

  const visiblePromptIds = $derived.by(() => {
    if (errorMessage) {
      return []
    }

    const loadedIds: string[] = []
    for (const promptId of screenPromptIds) {
      if (!contentDraftById[promptId]) {
        continue
      }

      const content = isTemplateFolder ? templateById[promptId] : promptById[promptId]
      if (
        content &&
        (isTemplateFolder
          ? isPromptTemplateFull(content as PromptTemplate)
          : isPromptFull(content as Prompt))
      ) {
        loadedIds.push(promptId)
      }
    }

    return loadedIds
  })

  const navigablePromptIds = $derived(
    allActiveScreenPromptIds.filter((promptId) => {
      const content = isTemplateFolder ? templateById[promptId] : promptById[promptId]
      return Boolean(
        contentDraftById[promptId] &&
          content &&
          (isTemplateFolder
            ? isPromptTemplateFull(content as PromptTemplate)
            : isPromptFull(content as Prompt))
      )
    })
  )

  const isVirtualContentReady = $derived.by(() => {
    if (errorMessage) return true
    if (isLoading) return false
    if (!screenRootFolder) return false
    if (!screenRootFolderDraft?.hasLoadedInitialData) return false
    return renderedPromptIds.every((promptId) => {
      const content = isTemplateFolder ? templateById[promptId] : promptById[promptId]
      return Boolean(
        contentDraftById[promptId] &&
          content &&
          (isTemplateFolder
            ? isPromptTemplateFull(content as PromptTemplate)
            : isPromptFull(content as Prompt))
      )
    })
  })

  const findItems = $derived.by((): PromptFolderFindItem[] => {
    const nextItems: PromptFolderFindItem[] = []

    for (const currentPromptId of visiblePromptIds) {
      const promptDraft = contentDraftById[currentPromptId]
      if (!promptDraft) continue
      nextItems.push({
        entityId: currentPromptId,
        rowId: promptEditorRowId(currentPromptId),
        sections: [
          {
            key: PROMPT_FOLDER_FIND_TITLE_SECTION_KEY,
            text: promptDraft.title
          },
          {
            key: PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
            text: promptDraft.text
          }
        ]
      })
    }

    return nextItems
  })

  const hasManualSelectionSource = (): boolean => {
    if (promptNavigation.screenRootFolderId !== screenRootFolderId) {
      return false
    }

    return (
      promptNavigation.selectionSource === 'tree-click' ||
      promptNavigation.selectionSource === 'folder-open' ||
      promptNavigation.selectionSource === 'prompt-create' ||
      promptNavigation.selectionSource === 'prompt-divider-create' ||
      promptNavigation.selectionSource === 'prompt-move' ||
      promptNavigation.selectionSource === 'folder-move' ||
      promptNavigation.selectionSource === 'header' ||
      promptNavigation.selectionSource === 'restore-hold'
    )
  }

  const resolveScrollFollowRow = (
    nextCenteredRow: ActivePromptTreeRow | null
  ): ActivePromptTreeRow | null => {
    // Treat near-zero virtual scroll values as the root page header.
    if (scrollTopPx < TOP_SCROLL_EPSILON_PX) {
      return { kind: 'root-header', rowOwnerFolderId: screenRootFolderId }
    }

    return nextCenteredRow
  }

  const clearManualSelectionSource = () => {
    const pendingFocus = promptNavigation.promptFocusRequests.pending
    if (
      pendingFocus?.payload.screenRootFolderId === screenRootFolderId &&
      promptNavigation.selectedRow === promptIdToPromptNavigationRow(pendingFocus.payload.promptId)
    ) {
      return
    }

    if (!hasManualSelectionSource()) {
      return
    }

    const fallbackRow = resolveScrollFollowRow(latestCenteredPromptTreeRow ?? activePromptTreeRow)
    if (!fallbackRow) {
      return
    }

    setCurrentFolderSelection(fallbackRow, 'scroll-follow')
  }

  const toPromptNavigationRow = (row: ActivePromptTreeRow): PromptNavigationRow => {
    return row.kind === 'prompt'
      ? `prompt:${row.promptId}`
      : row.kind === 'root-header'
        ? 'folder-root'
        : 'folder-settings'
  }

  const toActivePromptTreeRow = (
    rowOwnerFolderId: string,
    row: PromptNavigationRow
  ): ActivePromptTreeRow => {
    return row === 'folder-root'
      ? { kind: 'root-header', rowOwnerFolderId }
      : row === 'folder-settings'
        ? { kind: 'folder-settings', rowOwnerFolderId }
        : { kind: 'prompt', rowOwnerFolderId, promptId: row.slice('prompt:'.length) }
  }

  const toActivePromptTreeTarget = (target: PromptNavigationTarget): ActivePromptTreeRow =>
    toActivePromptTreeRow(target.rowOwnerFolderId, target.row)

  const toPromptFolderRowId = (row: ActivePromptTreeRow): string => {
    return row.kind === 'root-header'
      ? PROMPT_FOLDER_ROOT_HEADER_ROW_ID
      : row.kind === 'folder-settings'
        ? promptFolderEditorRowId(screenRootFolderId, row.rowOwnerFolderId)
        : promptEditorRowId(row.promptId)
  }

  const setSettingsSectionExpanded = (ownerFolderId: string, isExpanded: boolean) => {
    if (getIsSettingsSectionExpanded(ownerFolderId) === isExpanded) {
      return
    }

    const stateKey = getPromptFolderSectionStateKey(ownerFolderId)
    settingsSectionExpandedStates = {
      ...settingsSectionExpandedStates,
      [stateKey]: isExpanded
    }

    if (!workspaceId || isCompletedMode) {
      return
    }

    setPromptFolderSettingsSectionExpandedStateWithAutosave(workspaceId, ownerFolderId, isExpanded)
  }

  const toggleSettingsSectionExpanded = (ownerFolderId: string) => {
    setSettingsSectionExpanded(ownerFolderId, !getIsSettingsSectionExpanded(ownerFolderId))
  }

  const setPromptsSectionExpanded = (ownerFolderId: string, isExpanded: boolean) => {
    if (getIsPromptsSectionExpanded(ownerFolderId) === isExpanded) {
      return
    }

    const stateKey = getPromptFolderSectionStateKey(ownerFolderId)
    promptsSectionExpandedStates = {
      ...promptsSectionExpandedStates,
      [stateKey]: isExpanded
    }

    if (!workspaceId || isCompletedMode) {
      return
    }

    setPromptFolderPromptsSectionExpandedStateWithAutosave(workspaceId, ownerFolderId, isExpanded)
  }

  const togglePromptsSectionExpanded = (ownerFolderId: string) => {
    setPromptsSectionExpanded(ownerFolderId, !getIsPromptsSectionExpanded(ownerFolderId))
  }

  const findFolderPath = (
    _currentFolderId: string,
    targetFolderId: string,
    _visitedFolderIds = new SvelteSet<string>()
  ): string[] | null => {
    if (targetFolderId === screenRootFolderId) return [screenRootFolderId]
    return categoryById[targetFolderId] ? [screenRootFolderId, targetFolderId] : null
  }

  const expandSectionForRow = (row: ActivePromptTreeRow, expandFolderSettings = true): boolean => {
    let changed = false
    if (isCompletedMode || row.kind === 'root-header') return false

    const ownerPath = findFolderPath(screenRootFolderId, row.rowOwnerFolderId) ?? []
    for (const ancestorFolderId of ownerPath.slice(0, -1)) {
      if (!getIsPromptsSectionExpanded(ancestorFolderId)) {
        setPromptsSectionExpanded(ancestorFolderId, true)
        changed = true
      }
    }

    if (
      row.kind === 'folder-settings' &&
      expandFolderSettings &&
      !getIsSettingsSectionExpanded(row.rowOwnerFolderId)
    ) {
      setSettingsSectionExpanded(row.rowOwnerFolderId, true)
      changed = true
    }

    if (row.kind === 'prompt' && !getIsPromptsSectionExpanded(row.rowOwnerFolderId)) {
      setPromptsSectionExpanded(row.rowOwnerFolderId, true)
      changed = true
    }

    return changed
  }

  const selectedNavigationTarget = $derived.by((): ActivePromptTreeRow | null => {
    if (
      promptNavigation.screenRootFolderId !== screenRootFolderId ||
      !promptNavigation.rowOwnerFolderId ||
      !promptNavigation.selectedRow
    ) {
      return null
    }

    return toActivePromptTreeRow(promptNavigation.rowOwnerFolderId, promptNavigation.selectedRow)
  })

  const activePromptTreeRow = $derived(selectedNavigationTarget)

  const setCurrentFolderSelection = (
    nextRow: ActivePromptTreeRow | null,
    source: PromptNavigationSource,
    options: {
      forceRequest?: boolean
      contentReveal?: {
        scrollType: PromptContentRevealScrollType
        expandFolderSettings?: boolean
      }
      focusPromptId?: string
      treeExpansion?: 'owner' | 'ancestors'
    } = {}
  ) => {
    if (!nextRow) {
      return
    }

    promptNavigation.select({
      screenRootFolderId,
      rowOwnerFolderId: nextRow.rowOwnerFolderId,
      row: toPromptNavigationRow(nextRow),
      source,
      forceRequest: options.forceRequest ?? false,
      contentReveal: options.contentReveal,
      focusPromptId: options.focusPromptId,
      treeExpansion: options.treeExpansion
    })
  }

  const persistActivePromptTreeRow = () => {
    if (isCompletedMode) {
      return
    }

    const selectedTarget = selectedNavigationTarget
    if (!selectedTarget) {
      return
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return
    }

    setPromptFolderPromptTreeEntryIdWithAutosave(
      workspaceId,
      selectedTarget.rowOwnerFolderId,
      promptNavigationRowToPersistedEntryId(toPromptNavigationRow(selectedTarget))
    )
  }

  const selectCreatedPrompt = (rowOwnerFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      screenRootFolderId,
      rowOwnerFolderId,
      row,
      source: 'prompt-divider-create',
      forceRequest: true,
      contentReveal: { scrollType: 'minimal' },
      focusPromptId: promptId
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeEntryIdWithAutosave(
        workspaceId,
        rowOwnerFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }
  }

  const selectMovedPrompt = (
    destinationPromptFolderId: string,
    promptId: string,
    shouldRevealContent = true
  ): void => {
    const row = promptIdToPromptNavigationRow(promptId)
    const destinationRootFolderId = findContainingRootFolderId(destinationPromptFolderId)

    promptNavigation.select({
      screenRootFolderId: destinationRootFolderId,
      rowOwnerFolderId: destinationPromptFolderId,
      row,
      source: 'prompt-move',
      forceRequest: true,
      ...(shouldRevealContent ? { contentReveal: { scrollType: 'center' as const } } : {}),
      treeExpansion: 'owner'
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeEntryIdWithAutosave(
        workspaceId,
        destinationPromptFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onScreenRootFolderSelect(destinationRootFolderId)
  }

  const scrollToWithinWindowBandWithManualClear: ScrollToWithinWindowBand = (
    rowId,
    offsetPx,
    scrollType
  ) => {
    clearManualSelectionSource()
    scrollToWithinWindowBand?.(rowId, offsetPx, scrollType)
  }

  const isSameNavigationTarget = (
    left: PromptNavigationTarget,
    right: PromptNavigationTarget
  ): boolean =>
    left.screenRootFolderId === right.screenRootFolderId &&
    left.rowOwnerFolderId === right.rowOwnerFolderId &&
    left.row === right.row

  const cancelNavigationTargetRequests = (target: PromptNavigationTarget): void => {
    const expansionRequest = promptNavigation.contentExpansionRequests.pending
    if (expansionRequest && isSameNavigationTarget(expansionRequest.payload, target)) {
      promptNavigation.contentExpansionRequests.cancel(expansionRequest)
    }

    const revealRequest = promptNavigation.contentRevealRequests.pending
    if (revealRequest && isSameNavigationTarget(revealRequest.payload, target)) {
      promptNavigation.contentRevealRequests.cancel(revealRequest)
    }

    const focusRequest = promptNavigation.promptFocusRequests.pending
    if (
      focusRequest?.payload.screenRootFolderId === target.screenRootFolderId &&
      target.row === promptIdToPromptNavigationRow(focusRequest.payload.promptId)
    ) {
      promptNavigation.promptFocusRequests.cancel(focusRequest)
    }
  }

  const hasCachedPromptFolderData = (nextPromptFolderId: string): boolean => {
    const promptFolderDraft = promptFolderDraftCollection.get(nextPromptFolderId)
    if (!promptFolderDraft?.hasLoadedInitialData) {
      return false
    }

    const cachedPromptFolder = promptFolderCollection.get(nextPromptFolderId)
    if (!cachedPromptFolder) {
      return false
    }

    for (const promptId of getActiveMarkdownContentIds(
      cachedPromptFolder,
      cachedPromptFolder.kind
    )) {
      if (cachedPromptFolder.kind === 'template') {
        const template = promptTemplateCollection.get(promptId)
        if (!promptTemplateDraftCollection.get(promptId) || !template || !isPromptTemplateFull(template)) {
          return false
        }
      } else {
        const prompt = promptCollection.get(promptId)
        if (!promptDraftCollection.get(promptId) || !prompt || !isPromptFull(prompt)) {
          return false
        }
      }
    }

    return true
  }

  // Side effect: load prompt-folder records and reset local screen state when folder selection changes.
  $effect(() => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) return

    const nextPromptFolderLoadKey = `${workspaceId}:${screenRootFolderId}`
    if (previousPromptFolderLoadKey === nextPromptFolderLoadKey) return

    previousPromptFolderLoadKey = nextPromptFolderLoadKey
    promptFolderLoadRequestId += 1
    const requestId = promptFolderLoadRequestId
    const canUseCachedData = hasCachedPromptFolderData(screenRootFolderId)
    const currentNavigationTarget = selectedNavigationTarget
    const hasExplicitSelection =
      currentNavigationTarget !== null && promptNavigation.selectionSource !== 'scroll-follow'
    const explicitSelectionTarget = hasExplicitSelection ? currentNavigationTarget : null
    const persistedPromptTreeEntryId =
      !explicitSelectionTarget && !canUseCachedData
        ? lookupWorkspacePersistedPromptFolderPromptTreeEntryId(workspaceId, screenRootFolderId)
        : null
    const persistedSelectionTarget = persistedPromptTreeEntryId
      ? toActivePromptTreeRow(
          screenRootFolderId,
          persistedPromptTreeEntryIdToPromptNavigationRow(persistedPromptTreeEntryId)
        )
      : null
    const initialSelectionTarget = explicitSelectionTarget ??
      currentNavigationTarget ??
      persistedSelectionTarget ?? {
        kind: 'root-header',
        rowOwnerFolderId: screenRootFolderId
      }
    // Reveals an explicit or persisted selection after its virtual rows are first created.
    const shouldApplyInitialReveal =
      !isCompletedMode && Boolean(explicitSelectionTarget || persistedSelectionTarget)
    const restoredScrollTop = explicitSelectionTarget ? 0 : getRestoredPromptFolderScrollTop()
    const restoreSelectionSource: PromptNavigationSource =
      persistedSelectionTarget || (!explicitSelectionTarget && restoredScrollTop <= 0)
        ? 'restore-hold'
        : 'restore'

    isLoading = !canUseCachedData
    shouldShowLoadingOverlay = !canUseCachedData
    initialContentRevealRequestId = null
    isCreatingPrompt = false
    errorMessage = null
    initialPromptFolderScrollTopPx = restoredScrollTop
    scrollTopPx = restoredScrollTop
    latestCenteredPromptTreeRow = isCompletedMode ? null : initialSelectionTarget

    if (shouldApplyInitialReveal) {
      const source = explicitSelectionTarget
        ? promptNavigation.selectionSource!
        : restoreSelectionSource
      // Preserves sidebar folder alignment when navigation also opens the prompt-folder screen.
      const initialRevealScrollType: PromptContentRevealScrollType =
        explicitSelectionTarget?.kind === 'folder-settings' &&
        (source === 'tree-click' || source === 'folder-open')
          ? 'align-top'
          : 'center'
      const result = promptNavigation.select({
        screenRootFolderId,
        rowOwnerFolderId: initialSelectionTarget.rowOwnerFolderId,
        row: toPromptNavigationRow(initialSelectionTarget),
        source,
        forceRequest: true,
        contentReveal: {
          scrollType: initialRevealScrollType,
          expandFolderSettings:
            source !== 'folder-open' && source !== 'folder-move'
        },
        focusPromptId:
          source === 'prompt-create' && initialSelectionTarget.kind === 'prompt'
            ? initialSelectionTarget.promptId
            : undefined,
        treeExpansion:
          source === 'prompt-move' ? 'owner' : source === 'folder-move' ? 'ancestors' : undefined
      })
      initialContentRevealRequestId = result.contentRevealRequest?.id ?? null
    } else if (!currentNavigationTarget) {
      setCurrentFolderSelection(initialSelectionTarget, restoreSelectionSource, {
        forceRequest: true
      })
    }

    void (async () => {
      try {
        await loadPromptFolderInitial(workspaceId, screenRootFolderId)
        if (requestId !== promptFolderLoadRequestId) return
        isLoading = !hasCachedPromptFolderData(screenRootFolderId)
      } catch (error) {
        if (requestId !== promptFolderLoadRequestId) return
        errorMessage = error instanceof Error ? error.message : String(error)
        isLoading = false
        const pendingReveal = promptNavigation.contentRevealRequests.pending
        if (pendingReveal?.id === initialContentRevealRequestId) {
          cancelNavigationTargetRequests(pendingReveal.payload)
        }
      }
    })()
  })

  const hasPromptFolderRow = (target: ActivePromptTreeRow): boolean => {
    if (target.kind === 'root-header') return true
    if (target.kind === 'folder-settings') {
      return activePromptFolderScreenRows.some(
        (row) => row.kind === 'folder-editor' && row.ownerFolderId === target.rowOwnerFolderId
      )
    }
    return visiblePromptIds.includes(target.promptId)
  }

  // Side effect: expand the requested content path once folder rows are ready.
  $effect(() => {
    const request = promptNavigation.contentExpansionRequests.pending
    if (!request || request.payload.screenRootFolderId !== screenRootFolderId) return
    if (!isVirtualContentReady) return

    promptNavigation.contentExpansionRequests.consume(request, (payload) => {
      expandSectionForRow(toActivePromptTreeTarget(payload), payload.expandFolderSettings)
    })
  })

  // Side effect: reveal and acknowledge a requested content row once the virtual window is ready.
  $effect(() => {
    const request = promptNavigation.contentRevealRequests.pending
    if (!request || request.payload.screenRootFolderId !== screenRootFolderId) return
    if (!isVirtualContentReady) return
    if (!viewportMetrics || viewportMetrics.heightPx <= 0) return

    const pendingExpansion = promptNavigation.contentExpansionRequests.pending
    if (pendingExpansion && isSameNavigationTarget(pendingExpansion.payload, request.payload)) {
      return
    }

    const target = toActivePromptTreeTarget(request.payload)
    if (!hasPromptFolderRow(target)) {
      promptNavigation.contentRevealRequests.cancel(request)
      return
    }

    if (request.payload.scrollType === 'center' && !scrollToAndTrackRowCentered) return
    if (request.payload.scrollType !== 'center' && !scrollToWithinWindowBand) return

    promptNavigation.contentRevealRequests.consume(request, (payload) => {
      const rowId = toPromptFolderRowId(toActivePromptTreeTarget(payload))
      if (payload.scrollType === 'center') {
        scrollToAndTrackRowCentered!(rowId)
      } else {
        scrollToWithinWindowBand!(
          rowId,
          0,
          payload.scrollType,
          payload.scrollType === 'align-top' ? NAVIGATED_FOLDER_TOP_OFFSET_PX : undefined
        )
      }
    })
  })

  // Side effect: normalize stale prompt selections once rows are loaded.
  $effect(() => {
    if (!isVirtualContentReady) return
    if (isCompletedMode) return
    if (!activePromptTreeRow || activePromptTreeRow.kind !== 'prompt') return
    if (navigablePromptIds.includes(activePromptTreeRow.promptId)) return

    setCurrentFolderSelection(
      activePromptTreeRow.rowOwnerFolderId === screenRootFolderId
        ? { kind: 'root-header', rowOwnerFolderId: screenRootFolderId }
        : {
            kind: 'folder-settings',
            rowOwnerFolderId: activePromptTreeRow.rowOwnerFolderId
      },
      'restore',
      { forceRequest: true }
    )
  })

  const movePromptFromFolder = async (
    sourcePromptFolderId: string,
    promptId: string,
    destinationPromptFolderId: string,
    previousEntryId: string | null,
    categoryId: string | null
  ): Promise<boolean> => {
    const sourcePromptFolder = promptFolderCollection.get(sourcePromptFolderId)
    if (
      !sourcePromptFolder ||
      sourcePromptFolder.kind !== contentKind
    ) {
      return false
    }

    const destinationPromptFolder = promptFolderCollection.get(destinationPromptFolderId)
    if (
      !destinationPromptFolder ||
      destinationPromptFolder.kind !== contentKind ||
      sourcePromptFolder.kind !== destinationPromptFolder.kind
    ) {
      return false
    }

    return await runIpcBestEffort(
      async () => {
        if (isTemplateFolder) {
          await movePromptTemplate(
            sourcePromptFolder.id,
            destinationPromptFolderId,
            promptId,
            previousEntryId,
            categoryId
          )
        } else {
          await movePrompt(
            sourcePromptFolder.id,
            destinationPromptFolderId,
            promptId,
            previousEntryId,
            categoryId
          )
        }
        return true
      },
      () => false
    )
  }

  const handleAddPrompt = async (target: PromptFolderDividerTarget) => {
    const rowOwnerFolder = promptFolderCollection.get(screenRootFolderId)
    if (!rowOwnerFolder || isCreatingPrompt) {
      return
    }

    isCreatingPrompt = true

    if (isTemplateFolder) {
      const creation = createBlankPromptTemplateInFolder(
        rowOwnerFolder.id,
        target.previousEntryId,
        target.categoryId
      )
      selectCreatedPrompt(target.categoryId ?? rowOwnerFolder.id, creation.templateId)
      await runIpcBestEffort(() => creation.persistence)
    } else {
      const creation = createBlankPromptInFolder(
        rowOwnerFolder.id,
        target.previousEntryId,
        target.categoryId
      )
      selectCreatedPrompt(target.categoryId ?? rowOwnerFolder.id, creation.promptId)
      await runIpcBestEffort(() => creation.persistence)
    }

    isCreatingPrompt = false
  }

  const handleDeletePrompt = (target: PromptFolderPromptTarget) => {
    if (!promptFolderCollection.get(screenRootFolderId)) {
      return
    }

    void runIpcBestEffort(async () => {
      if (isTemplateFolder) {
        await deletePromptTemplate(screenRootFolderId, target.promptId)
      } else {
        await deletePrompt(screenRootFolderId, target.promptId)
      }
    })
  }

  const handleSetPromptStatus = (target: PromptFolderPromptTarget, status: PromptStatus) => {
    if (isTemplateFolder) return
    if (!promptFolderCollection.get(screenRootFolderId)) {
      return
    }

    void runIpcBestEffort(async () => {
      await setPromptStatus(screenRootFolderId, screenRootFolderId, target.promptId, status)
    })
  }

  const logicalPromptDropTargets = $derived.by<PromptHandleDropPayload[]>(() => {
    if (!screenRootFolder) return []
    /** Linear placement targets spanning Uncategorized and every category. */
    const targets: PromptHandleDropPayload[] = []
    for (const group of screenRootFolder.categoryOrder.categories) {
      targets.push({
        folderId: screenRootFolder.id,
        categoryId: group.categoryId,
        targetEntryId: null,
        position: 'after'
      })
      for (const entry of group.entries) {
        targets.push({
          folderId: screenRootFolder.id,
          categoryId: group.categoryId,
          targetEntryId: entry.id,
          position: 'after'
        })
      }
    }
    return targets
  })

  /** Returns active content IDs for one exact category group. */
  const getCategoryEntryIds = (categoryId: string | null): string[] =>
    screenRootFolder?.categoryOrder.categories
      .find((group) => group.categoryId === categoryId)
      ?.entries.map((entry) => entry.id) ?? []

  const resolveAdjacentPromptMove = (
    target: PromptFolderPromptTarget,
    direction: 'up' | 'down'
  ) => {
    const currentTargetIndex = logicalPromptDropTargets.findIndex(
      (candidate) =>
        (candidate.categoryId ?? null) === target.categoryId &&
        candidate.targetEntryId === target.promptId &&
        candidate.position === 'after'
    )
    if (currentTargetIndex === -1) return null

    const step = direction === 'up' ? -1 : 1
    for (
      let targetIndex = currentTargetIndex + step;
      targetIndex >= 0 && targetIndex < logicalPromptDropTargets.length;
      targetIndex += step
    ) {
      const dropTarget = logicalPromptDropTargets[targetIndex]
      /** Destination category entry IDs used by no-op detection. */
      const destinationEntryIds = getCategoryEntryIds(dropTarget.categoryId ?? null)
      const move = resolvePromptHandleDropMove(
        target.categoryId ?? 'uncategorized',
        getCategoryEntryIds(target.categoryId),
        target.promptId,
        { ...dropTarget, folderId: dropTarget.categoryId ?? 'uncategorized' },
        destinationEntryIds
      )
      if (move) {
        return {
          ...move,
          sourcePromptFolderId: screenRootFolderId,
          destinationPromptFolderId: screenRootFolderId,
          categoryId: dropTarget.categoryId ?? null
        }
      }
    }
    return null
  }

  const canMovePrompt = (target: PromptFolderPromptTarget, direction: 'up' | 'down'): boolean =>
    resolveAdjacentPromptMove(target, direction) !== null

  const movePromptToAdjacentTarget = async (
    target: PromptFolderPromptTarget,
    direction: 'up' | 'down'
  ): Promise<boolean> => {
    const move = resolveAdjacentPromptMove(target, direction)
    if (!move) return false
    scrollApi?.compensateForRowMove(
      promptEditorRowId(move.promptId),
      promptFolderDividerRowId(
        screenRootFolderId,
        target.ownerFolderId,
        move.promptId
      ),
      promptFolderDividerRowId(
        screenRootFolderId,
        move.categoryId ?? screenRootFolderId,
        move.previousEntryId
      )
    )
    const didMove = await movePromptFromFolder(
      move.sourcePromptFolderId,
      move.promptId,
      move.destinationPromptFolderId,
      move.previousEntryId,
      move.categoryId
    )
    if (didMove && target.categoryId !== move.categoryId) {
      selectMovedPrompt(move.categoryId ?? screenRootFolderId, move.promptId, false)
    }
    return didMove
  }

  const handleMovePromptUp = (target: PromptFolderPromptTarget): Promise<boolean> =>
    movePromptToAdjacentTarget(target, 'up')

  const handleMovePromptDown = (target: PromptFolderPromptTarget): Promise<boolean> =>
    movePromptToAdjacentTarget(target, 'down')

  const handlePromptTreeDrop = (
    source: PromptFolderPromptTarget,
    dropPayload: PromptHandleDropPayload | null
  ) => {
    const sourcePromptFolder = promptFolderCollection.get(screenRootFolderId)
    if (!sourcePromptFolder) {
      return
    }

    if (dropPayload && dropPayload.folderId !== screenRootFolderId) {
      /** Different root selected through the sidebar folder dropdown. */
      const destinationPromptFolder = promptFolderCollection.get(dropPayload.folderId)
      if (!destinationPromptFolder || destinationPromptFolder.kind !== contentKind) return
      /** Cross-root placement always targets destination Uncategorized. */
      const nextMove = resolvePromptHandleDropMove(
        screenRootFolderId,
        getCategoryEntryIds(source.categoryId),
        source.promptId,
        { ...dropPayload, categoryId: null },
        getActiveMarkdownContentIds(destinationPromptFolder, contentKind)
      )
      if (!nextMove) return
      void movePromptFromFolder(
        screenRootFolderId,
        source.promptId,
        destinationPromptFolder.id,
        nextMove.previousEntryId,
        null
      )
      selectMovedPrompt(destinationPromptFolder.id, source.promptId)
      return
    }

    const nextMove = resolvePromptHandleDropMove(
      source.categoryId ?? 'uncategorized',
      getCategoryEntryIds(source.categoryId),
      source.promptId,
      dropPayload
        ? { ...dropPayload, folderId: dropPayload.categoryId ?? 'uncategorized' }
        : null,
      dropPayload
        ? ((): string[] | null => {
            return getCategoryEntryIds(dropPayload.categoryId ?? null)
          })()
        : null
    )
    if (!nextMove) {
      return
    }

    void movePromptFromFolder(
      screenRootFolderId,
      source.promptId,
      screenRootFolderId,
      nextMove.previousEntryId,
      dropPayload?.categoryId ?? null
    )

    if (source.categoryId !== (dropPayload?.categoryId ?? null)) {
      selectMovedPrompt(dropPayload?.categoryId ?? screenRootFolderId, source.promptId)
    }
  }

  const activeHeaderRowId = 'prompt-header' as const
  const activeHeaderSection = $derived(
    isTemplateFolder ? 'Templates' : isCompletedMode ? 'Completed Prompts' : 'Prompts'
  )

  const findRenderedPromptRow = (promptId: string): PromptFolderScreenPromptEditorRow | undefined =>
    activePromptFolderScreenRows.find(
      (row): row is PromptFolderScreenPromptEditorRow =>
        row.kind === 'prompt-editor' && row.promptId === promptId
    )

  const resolveHeaderSelectionRow = (): ActivePromptTreeRow => {
    const firstPromptId = visiblePromptIds[0]
    if (firstPromptId) {
      const promptRow = findRenderedPromptRow(firstPromptId)
      return {
        kind: 'prompt',
        rowOwnerFolderId: promptRow?.ownerFolderId ?? screenRootFolderId,
        promptId: firstPromptId
      }
    }

    return { kind: 'root-header', rowOwnerFolderId: screenRootFolderId }
  }

  const handleHeaderSegmentClick = () => {
    if (!scrollToWithinWindowBand) return
    const targetRow = resolveHeaderSelectionRow()
    expandSectionForRow(targetRow)
    setCurrentFolderSelection(targetRow, 'header', {
      forceRequest: true
    })
    // Header navigation should land directly on the target section.
    scrollToWithinWindowBand(toPromptFolderRowId(targetRow), 0, 'minimal', 0)
  }

  const handleHeaderFolderClick = () => {
    if (!scrollApi) return
    setCurrentFolderSelection(
      { kind: 'root-header', rowOwnerFolderId: screenRootFolderId },
      'header',
      { forceRequest: true }
    )
    scrollApi.scrollTo(0)
  }

  const handleFindMatchReveal = (match: PromptFolderFindMatch) => {
    const targetRow: ActivePromptTreeRow = {
      kind: 'prompt',
      rowOwnerFolderId: findRenderedPromptRow(match.entityId)?.ownerFolderId ?? screenRootFolderId,
      promptId: match.entityId
    }
    setCurrentFolderSelection(targetRow, 'find', {
      forceRequest: true,
      contentReveal: { scrollType: 'center' }
    })
  }

  const setScrollToWithinWindowBand = (
    nextScrollToWithinWindowBand: ScrollToWithinWindowBand | null
  ) => {
    scrollToWithinWindowBand = nextScrollToWithinWindowBand
  }

  const setScrollToAndTrackRowCentered = (
    nextScrollToAndTrackRowCentered: ScrollToAndTrackRowCentered | null
  ) => {
    scrollToAndTrackRowCentered = nextScrollToAndTrackRowCentered
  }

  const setScrollApi = (nextScrollApi: VirtualWindowScrollApi | null) => {
    scrollApi = nextScrollApi
  }

  const setViewportMetrics = (nextViewportMetrics: VirtualWindowViewportMetrics | null) => {
    viewportMetrics = nextViewportMetrics
  }

  const handleVirtualScrollTopChange = (nextScrollTop: number) => {
    scrollTopPx = nextScrollTop
    if (isCompletedMode) {
      return
    }

    recordPromptFolderScrollTop(screenRootFolderId, nextScrollTop)
  }

  const handleVirtualCenterRowChange = (nextCenteredRow: ActivePromptTreeRow | null) => {
    latestCenteredPromptTreeRow = nextCenteredRow
    if (hasManualSelectionSource()) return
    setCurrentFolderSelection(resolveScrollFollowRow(latestCenteredPromptTreeRow), 'scroll-follow')
  }

  const handleVirtualUserScroll = () => {
    clearManualSelectionSource()
    setCurrentFolderSelection(resolveScrollFollowRow(latestCenteredPromptTreeRow), 'scroll-follow')
  }

  return {
    get workspaceId(): string | null {
      return workspaceId
    },
    get screenRootFolderId(): string {
      return screenRootFolderId
    },
    get promptEditorSizingConfig(): PromptEditorSizingConfig {
      return promptEditorSizingConfig
    },
    get contentKind(): PromptFolderContentKind {
      return contentKind
    },
    get folderSettings(): PromptFolderSettings {
      return folderSettings
    },
    get folderSettingsByFolderId(): Record<string, PromptFolderSettings> {
      return folderSettingsByFolderId
    },
    get folderDisplayName(): string {
      return folderDisplayName
    },
    get screenRootFolder(): PromptFolder | null {
      return screenRootFolder
    },
    get promptFolders(): PromptFolder[] {
      return promptFolderQuery.data.filter(
        (currentPromptFolder): currentPromptFolder is PromptFolder =>
          currentPromptFolder !== undefined
      )
    },
    get categories(): Category[] {
      return categories
    },
    get activePromptFolderScreenRows(): PromptFolderScreenRow[] {
      return activePromptFolderScreenRows
    },
    get visiblePromptIds(): string[] {
      return visiblePromptIds
    },
    get activePromptCount(): number {
      return activePromptCount
    },
    get completedPromptCount(): number {
      return completedPromptCount
    },
    get completedPromptOwnerByPromptId(): Record<string, string> {
      return completedPromptOwnerByPromptId
    },
    get isVirtualContentReady(): boolean {
      return isVirtualContentReady
    },
    get promptDraftById(): Record<string, MarkdownContentDraftRecord> {
      return contentDraftById
    },
    get promptTemplateTextById(): Record<string, string> {
      return promptTemplateTextById
    },
    get promptMetadataByPromptId(): Record<string, PromptMetadata> {
      return promptMetadataByPromptId
    },
    get errorMessage(): string | null {
      return errorMessage
    },
    get isCreatingPrompt(): boolean {
      return isCreatingPrompt
    },
    get isSettingsSectionExpanded(): boolean {
      return isSettingsSectionExpanded
    },
    get isPromptsSectionExpanded(): boolean {
      return isPromptsSectionExpanded
    },
    get settingsSectionExpandedByFolderId(): Record<string, boolean> {
      return settingsSectionExpandedByFolderId
    },
    get promptsSectionExpandedByFolderId(): Record<string, boolean> {
      return promptsSectionExpandedByFolderId
    },
    get initialPromptFolderScrollTopPx(): number {
      return initialPromptFolderScrollTopPx
    },
    get findItems(): PromptFolderFindItem[] {
      return findItems
    },
    get activeHeaderRowId(): 'prompt-header' {
      return activeHeaderRowId
    },
    get activeHeaderSection(): 'Prompts' | 'Completed Prompts' | 'Templates' {
      return activeHeaderSection
    },
    get loadingOverlay() {
      return loadingOverlay
    },
    get loadingOverlayFadeMs(): number {
      return LOADING_OVERLAY_FADE_MS
    },
    persistActivePromptTreeRow,
    scrollToWithinWindowBandWithManualClear,
    toggleSettingsSectionExpanded,
    togglePromptsSectionExpanded,
    handleHeaderSegmentClick,
    handleHeaderFolderClick,
    handleFindMatchReveal,
    handleAddPrompt,
    handleDeletePrompt,
    handleSetPromptStatus,
    handleMovePromptUp,
    handleMovePromptDown,
    canMovePrompt,
    handlePromptTreeDrop,
    setScrollToWithinWindowBand,
    setScrollToAndTrackRowCentered,
    setScrollApi,
    setViewportMetrics,
    handleVirtualScrollTopChange,
    handleVirtualCenterRowChange,
    handleVirtualUserScroll
  }
}

export type PromptFolderScreenController = ReturnType<typeof createPromptFolderScreenController>
