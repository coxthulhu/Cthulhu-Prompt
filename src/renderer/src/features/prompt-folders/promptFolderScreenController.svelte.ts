import { useLiveQuery } from '@tanstack/svelte-db'
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
  getCategoryOrderCategoryIds,
  type PromptFolder,
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
  lookupWorkspacePersistedPromptFolderDetailsSectionExpandedState,
  lookupWorkspacePersistedPromptFolderContentSectionExpandedState,
  lookupWorkspacePersistedPromptFolderSelectedEntryId,
  setPromptFolderDetailsSectionExpandedStateWithAutosave,
  setPromptFolderContentSectionExpandedStateWithAutosave,
  setPromptFolderSelectedEntryIdWithAutosave
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
  categoryEditorRowId
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
import { createPromptTreePromptDragController } from '../sidebar/promptTreeDrag'

/** Virtual prompt-folder row currently aligned with sidebar navigation. */
export type ActivePromptScreenRow =
  | { kind: 'root-header'; contentOwnerId: string }
  | { kind: 'category-details'; contentOwnerId: string }
  | { kind: 'prompt'; contentOwnerId: string; promptId: string }

// Leaves navigated folder headers comfortably below the virtual viewport edge.
const NAVIGATED_FOLDER_TOP_OFFSET_PX = 80
/** Samples breadcrumb ownership just below align-top placement so navigation updates immediately. */
const BREADCRUMB_SAMPLE_OFFSET_PX = NAVIGATED_FOLDER_TOP_OFFSET_PX + 4

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
  /** Session-latched prompt edit markers indexed by authoritative prompt ID. */
  const promptEditedById = $derived.by<Record<string, boolean>>(() =>
    Object.fromEntries(promptDraftQuery.data.map((draft) => [draft.id, draft.isEdited]))
  )
  /** Session-latched template edit markers indexed by authoritative template ID. */
  const promptTemplateEditedById = $derived.by<Record<string, boolean>>(() =>
    Object.fromEntries(promptTemplateDraftQuery.data.map((draft) => [draft.id, draft.isEdited]))
  )
  /** Canonical prompt-template titles used to label prompt template selections. */
  const templateTitleById = $derived.by(() =>
    Object.fromEntries(
      promptTemplateQuery.data.map((template) => [
        template.id,
        getPromptTitleText(template)
      ])
    )
  )
  /** Canonical full template text used when applying selected prompt templates. */
  const promptTemplateTextById = $derived.by<Record<string, string>>(() =>
    Object.fromEntries(
      promptTemplateQuery.data.flatMap((template) =>
        isPromptTemplateFull(template) ? [[template.id, template.templateText]] : []
      )
    )
  )
  /** Full canonical content projected with its renderer-session edit marker for editor rows. */
  const contentDraftById = $derived.by<Record<string, MarkdownContentDraftRecord>>(() => {
    if (!isTemplateFolder) {
      return Object.fromEntries(
        promptQuery.data.flatMap((prompt) => {
          if (!isPromptFull(prompt)) return []
          // Resolved names drive both the compact label and its additional-template count.
          const templateNames = (prompt.templates ?? []).flatMap((template) => {
            const title = templateTitleById[template.id]
            return title === undefined ? [] : [title]
          })
          // Missing references are skipped so the first available template names the selection.
          const templateName = templateNames[0]
          return [
            [
              prompt.id,
              {
                id: prompt.id,
                title: prompt.title,
                fallbackTitle: prompt.fallbackTitle,
                modifiedAt: prompt.modifiedAt,
                text: prompt.promptText,
                ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
                templateName:
                  prompt.templates === undefined
                    ? 'Not Selected'
                    : templateName === undefined
                      ? 'No Template'
                      : templateNames.length > 1
                        ? `${templateName} + ${templateNames.length - 1} More`
                        : templateName,
                // Missing template ids use the same indicator treatment as No Template.
                templateState:
                  prompt.templates === undefined
                    ? 'not-selected'
                    : templateName === undefined
                      ? 'no-template'
                      : 'selected',
                isEdited: promptEditedById[prompt.id] ?? false
              }
            ] as const
          ]
        })
      )
    }

    return Object.fromEntries(
      promptTemplateQuery.data.flatMap((template) =>
        isPromptTemplateFull(template)
          ? [
              [
                template.id,
                {
                  id: template.id,
                  title: template.title,
                  fallbackTitle: template.fallbackTitle,
                  modifiedAt: template.modifiedAt,
                  text: template.templateText,
                  isEdited: promptTemplateEditedById[template.id] ?? false
                }
              ] as const
            ]
          : []
      )
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
  const findContainingRootFolderId = (contentOwnerId: string): string =>
    categoryById[contentOwnerId] ? screenRootFolderId : contentOwnerId
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
  const completedPromptContentOwnerByPromptId = $derived.by<Record<string, string>>(() =>
    Object.fromEntries(
      completedPrompts.map(({ contentOwnerId, promptId }) => [promptId, contentOwnerId])
    )
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
  let latestCenteredPromptScreenRow = $state<ActivePromptScreenRow | null>(null)
  let scrollTopPx = $state(getRestoredPromptFolderScrollTop())
  /** Category currently owning the breadcrumb's padded viewport sample point. */
  let breadcrumbCategoryId = $state<string | null>(null)
  const TOP_SCROLL_EPSILON_PX = 1

  let detailsSectionExpandedStates = $state<Record<string, boolean>>({})
  let contentSectionExpandedStates = $state<Record<string, boolean>>({})

  const getContentSectionStateKey = (contentOwnerId: string): string =>
    `${workspaceId ?? 'no-workspace'}:${contentOwnerId}:${screenMode}`

  const lookupPersistedDetailsSectionExpandedState = (contentOwnerId: string): boolean => {
    if (isCompletedMode) {
      return false
    }

    if (!workspaceId) {
      return false
    }

    return (
      lookupWorkspacePersistedPromptFolderDetailsSectionExpandedState(
        workspaceId,
        contentOwnerId
      ) ?? false
    )
  }

  const lookupPersistedContentSectionExpandedState = (contentOwnerId: string): boolean => {
    if (isCompletedMode) {
      return true
    }

    if (!workspaceId) {
      return true
    }

    return (
      lookupWorkspacePersistedPromptFolderContentSectionExpandedState(workspaceId, contentOwnerId) ??
      true
    )
  }

  const getIsContentSectionExpanded = (contentOwnerId: string): boolean =>
    contentSectionExpandedStates[getContentSectionStateKey(contentOwnerId)] ??
    lookupPersistedContentSectionExpandedState(contentOwnerId)

  const getIsDetailsSectionExpanded = (contentOwnerId: string): boolean =>
    detailsSectionExpandedStates[getContentSectionStateKey(contentOwnerId)] ??
    lookupPersistedDetailsSectionExpandedState(contentOwnerId)

  const contentSectionExpandedByOwnerId = $derived.by<Record<string, boolean>>(() => {
    const expandedByOwnerId: Record<string, boolean> = {}
    for (const folder of promptFolderQuery.data) {
      if (!folder) continue
      expandedByOwnerId[folder.id] = getIsContentSectionExpanded(folder.id)
    }
    for (const category of categories) {
      expandedByOwnerId[category.id] = getIsContentSectionExpanded(category.id)
    }
    return expandedByOwnerId
  })
  const detailsSectionExpandedByOwnerId = $derived.by<Record<string, boolean>>(() => {
    const expandedByOwnerId: Record<string, boolean> = {}
    for (const folder of promptFolderQuery.data) {
      if (!folder) continue
      expandedByOwnerId[folder.id] = getIsDetailsSectionExpanded(folder.id)
    }
    for (const category of categories) {
      expandedByOwnerId[category.id] = getIsDetailsSectionExpanded(category.id)
    }
    return expandedByOwnerId
  })
  const isContentSectionExpanded = $derived(
    contentSectionExpandedByOwnerId[screenRootFolderId] ??
      lookupPersistedContentSectionExpandedState(screenRootFolderId)
  )
  const isDetailsSectionExpanded = $derived(
    detailsSectionExpandedByOwnerId[screenRootFolderId] ??
      lookupPersistedDetailsSectionExpandedState(screenRootFolderId)
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
      isCategoryExpanded: (categoryId) => contentSectionExpandedByOwnerId[categoryId] ?? true
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
      isCategoryExpanded: () => true
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
      promptNavigation.selectionSource === 'category-open' ||
      promptNavigation.selectionSource === 'prompt-create' ||
      promptNavigation.selectionSource === 'prompt-divider-create' ||
      promptNavigation.selectionSource === 'prompt-tree-create' ||
      promptNavigation.selectionSource === 'prompt-move' ||
      promptNavigation.selectionSource === 'category-move' ||
      promptNavigation.selectionSource === 'header' ||
      promptNavigation.selectionSource === 'restore-hold'
    )
  }

  const resolveScrollFollowRow = (
    nextCenteredRow: ActivePromptScreenRow | null
  ): ActivePromptScreenRow | null => {
    // Treat near-zero virtual scroll values as the root page header.
    if (scrollTopPx < TOP_SCROLL_EPSILON_PX) {
      return { kind: 'root-header', contentOwnerId: screenRootFolderId }
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

    const fallbackRow = resolveScrollFollowRow(
      latestCenteredPromptScreenRow ?? activePromptScreenRow
    )
    if (!fallbackRow) {
      return
    }

    setCurrentFolderSelection(fallbackRow, 'scroll-follow')
  }

  const toPromptNavigationRow = (row: ActivePromptScreenRow): PromptNavigationRow => {
    return row.kind === 'prompt'
      ? `prompt:${row.promptId}`
      : row.kind === 'root-header'
        ? 'root-header'
        : 'category-details'
  }

  const toActivePromptScreenRow = (
    contentOwnerId: string,
    row: PromptNavigationRow
  ): ActivePromptScreenRow => {
    return row === 'root-header'
      ? { kind: 'root-header', contentOwnerId }
      : row === 'category-details'
        ? { kind: 'category-details', contentOwnerId }
        : { kind: 'prompt', contentOwnerId, promptId: row.slice('prompt:'.length) }
  }

  const toActivePromptScreenTarget = (target: PromptNavigationTarget): ActivePromptScreenRow =>
    toActivePromptScreenRow(target.contentOwnerId, target.row)

  const toPromptFolderRowId = (row: ActivePromptScreenRow): string => {
    return row.kind === 'root-header'
      ? PROMPT_FOLDER_ROOT_HEADER_ROW_ID
      : row.kind === 'category-details'
        ? categoryEditorRowId(row.contentOwnerId)
        : promptEditorRowId(row.promptId)
  }

  const setDetailsSectionExpanded = (contentOwnerId: string, isExpanded: boolean) => {
    if (getIsDetailsSectionExpanded(contentOwnerId) === isExpanded) {
      return
    }

    const stateKey = getContentSectionStateKey(contentOwnerId)
    detailsSectionExpandedStates = {
      ...detailsSectionExpandedStates,
      [stateKey]: isExpanded
    }

    if (!workspaceId || isCompletedMode) {
      return
    }

    setPromptFolderDetailsSectionExpandedStateWithAutosave(workspaceId, contentOwnerId, isExpanded)
  }

  const toggleDetailsSectionExpanded = (contentOwnerId: string) => {
    setDetailsSectionExpanded(contentOwnerId, !getIsDetailsSectionExpanded(contentOwnerId))
  }

  const setContentSectionExpanded = (contentOwnerId: string, isExpanded: boolean) => {
    if (getIsContentSectionExpanded(contentOwnerId) === isExpanded) {
      return
    }

    const stateKey = getContentSectionStateKey(contentOwnerId)
    contentSectionExpandedStates = {
      ...contentSectionExpandedStates,
      [stateKey]: isExpanded
    }

    if (!workspaceId || isCompletedMode) {
      return
    }

    setPromptFolderContentSectionExpandedStateWithAutosave(workspaceId, contentOwnerId, isExpanded)
  }

  const toggleContentSectionExpanded = (contentOwnerId: string) => {
    setContentSectionExpanded(contentOwnerId, !getIsContentSectionExpanded(contentOwnerId))
  }

  const findContentOwnerPath = (contentOwnerId: string): string[] | null => {
    if (contentOwnerId === screenRootFolderId) return [screenRootFolderId]
    return categoryById[contentOwnerId] ? [screenRootFolderId, contentOwnerId] : null
  }

  /** Expands the main-screen sections required to reveal one navigation row. */
  const expandSectionForRow = (
    row: ActivePromptScreenRow,
    expandDetails = true,
    expandContent = false
  ): boolean => {
    let changed = false
    if (isCompletedMode || row.kind === 'root-header') return false

    const ownerPath = findContentOwnerPath(row.contentOwnerId) ?? []
    for (const ancestorOwnerId of ownerPath.slice(0, -1)) {
      if (!getIsContentSectionExpanded(ancestorOwnerId)) {
        setContentSectionExpanded(ancestorOwnerId, true)
        changed = true
      }
    }

    if (
      row.kind === 'category-details' &&
      expandDetails &&
      !getIsDetailsSectionExpanded(row.contentOwnerId)
    ) {
      setDetailsSectionExpanded(row.contentOwnerId, true)
      changed = true
    }

    if (
      row.kind === 'category-details' &&
      expandContent &&
      !getIsContentSectionExpanded(row.contentOwnerId)
    ) {
      setContentSectionExpanded(row.contentOwnerId, true)
      changed = true
    }

    if (row.kind === 'prompt' && !getIsContentSectionExpanded(row.contentOwnerId)) {
      setContentSectionExpanded(row.contentOwnerId, true)
      changed = true
    }

    return changed
  }

  const selectedNavigationTarget = $derived.by((): ActivePromptScreenRow | null => {
    if (
      promptNavigation.screenRootFolderId !== screenRootFolderId ||
      !promptNavigation.contentOwnerId ||
      !promptNavigation.selectedRow
    ) {
      return null
    }

    return toActivePromptScreenRow(promptNavigation.contentOwnerId, promptNavigation.selectedRow)
  })

  const activePromptScreenRow = $derived(selectedNavigationTarget)

  const setCurrentFolderSelection = (
    nextRow: ActivePromptScreenRow | null,
    source: PromptNavigationSource,
    options: {
      forceRequest?: boolean
      contentReveal?: {
        scrollType: PromptContentRevealScrollType
        expandDetails?: boolean
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
      contentOwnerId: nextRow.contentOwnerId,
      row: toPromptNavigationRow(nextRow),
      source,
      forceRequest: options.forceRequest ?? false,
      contentReveal: options.contentReveal,
      focusPromptId: options.focusPromptId,
      treeExpansion: options.treeExpansion
    })
  }

  const persistActivePromptScreenRow = () => {
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

    setPromptFolderSelectedEntryIdWithAutosave(
      workspaceId,
      selectedTarget.contentOwnerId,
      promptNavigationRowToPersistedEntryId(toPromptNavigationRow(selectedTarget))
    )
  }

  const selectCreatedPrompt = (contentOwnerId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      screenRootFolderId,
      contentOwnerId,
      row,
      source: 'prompt-divider-create',
      forceRequest: true,
      contentReveal: { scrollType: 'minimal' },
      focusPromptId: promptId
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderSelectedEntryIdWithAutosave(
        workspaceId,
        contentOwnerId,
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
      contentOwnerId: destinationPromptFolderId,
      row,
      source: 'prompt-move',
      forceRequest: true,
      ...(shouldRevealContent ? { contentReveal: { scrollType: 'center' as const } } : {}),
      treeExpansion: 'owner'
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderSelectedEntryIdWithAutosave(
        workspaceId,
        destinationPromptFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onScreenRootFolderSelect(destinationRootFolderId)
  }

  const promptDragController = createPromptTreePromptDragController({
    getPromptFolders: () => promptFolderQuery.data,
    onPromptMove: (move, sourceCategoryId) => {
      if (
        move.sourcePromptFolderId === move.destinationPromptFolderId &&
        sourceCategoryId !== move.categoryId
      ) {
        selectMovedPrompt(move.categoryId ?? move.destinationPromptFolderId, move.promptId)
      }
    }
  })

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
    left.contentOwnerId === right.contentOwnerId &&
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
    const persistedSelectedEntryId =
      !explicitSelectionTarget && !canUseCachedData
        ? lookupWorkspacePersistedPromptFolderSelectedEntryId(workspaceId, screenRootFolderId)
        : null
    const persistedSelectionTarget = persistedSelectedEntryId
      ? toActivePromptScreenRow(
          screenRootFolderId,
          persistedPromptTreeEntryIdToPromptNavigationRow(persistedSelectedEntryId)
        )
      : null
    const initialSelectionTarget = explicitSelectionTarget ??
      currentNavigationTarget ??
      persistedSelectionTarget ?? {
        kind: 'root-header',
        contentOwnerId: screenRootFolderId
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
    latestCenteredPromptScreenRow = isCompletedMode ? null : initialSelectionTarget

    if (shouldApplyInitialReveal) {
      const source = explicitSelectionTarget
        ? promptNavigation.selectionSource!
        : restoreSelectionSource
      // Preserves sidebar category alignment when navigation also opens the prompt-folder screen.
      const initialRevealScrollType: PromptContentRevealScrollType =
        explicitSelectionTarget?.kind === 'category-details' &&
        (source === 'tree-click' || source === 'category-open')
          ? 'align-top'
          : 'center'
      const result = promptNavigation.select({
        screenRootFolderId,
        contentOwnerId: initialSelectionTarget.contentOwnerId,
        row: toPromptNavigationRow(initialSelectionTarget),
        source,
        forceRequest: true,
        contentReveal: {
          scrollType: initialRevealScrollType,
          expandDetails:
            source !== 'category-open' && source !== 'category-move',
          expandContent: source === 'category-open'
        },
        focusPromptId:
          (source === 'prompt-create' || source === 'prompt-tree-create') &&
          initialSelectionTarget.kind === 'prompt'
            ? initialSelectionTarget.promptId
            : undefined,
        treeExpansion:
          source === 'prompt-move'
            ? 'owner'
            : source === 'category-open' || source === 'prompt-tree-create'
              ? 'owner'
              : source === 'category-move'
                ? 'ancestors'
                : undefined
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

  const hasPromptScreenRow = (target: ActivePromptScreenRow): boolean => {
    if (target.kind === 'root-header') return true
    if (target.kind === 'category-details') {
      return activePromptFolderScreenRows.some(
        (row) =>
          row.kind === 'category-editor' && row.contentOwnerId === target.contentOwnerId
      )
    }
    return visiblePromptIds.includes(target.promptId)
  }

  // Side effect: expand the requested content path once category rows are ready.
  $effect(() => {
    const request = promptNavigation.contentExpansionRequests.pending
    if (!request || request.payload.screenRootFolderId !== screenRootFolderId) return
    if (!isVirtualContentReady) return

    promptNavigation.contentExpansionRequests.consume(request, (payload) => {
      expandSectionForRow(
        toActivePromptScreenTarget(payload),
        payload.expandDetails,
        payload.expandContent
      )
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

    const target = toActivePromptScreenTarget(request.payload)
    if (!hasPromptScreenRow(target)) {
      promptNavigation.contentRevealRequests.cancel(request)
      return
    }

    if (request.payload.scrollType === 'center' && !scrollToAndTrackRowCentered) return
    if (request.payload.scrollType !== 'center' && !scrollToWithinWindowBand) return

    promptNavigation.contentRevealRequests.consume(request, (payload) => {
      const rowId = toPromptFolderRowId(toActivePromptScreenTarget(payload))
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
    if (!activePromptScreenRow || activePromptScreenRow.kind !== 'prompt') return
    if (navigablePromptIds.includes(activePromptScreenRow.promptId)) return

    setCurrentFolderSelection(
      activePromptScreenRow.contentOwnerId === screenRootFolderId
        ? { kind: 'root-header', contentOwnerId: screenRootFolderId }
        : {
            kind: 'category-details',
            contentOwnerId: activePromptScreenRow.contentOwnerId
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
        position: 'after',
        statusSection: 'active'
      })
      for (const entry of group.entries) {
        targets.push({
          folderId: screenRootFolder.id,
          categoryId: group.categoryId,
          targetEntryId: entry.id,
          position: 'after',
          statusSection: 'active'
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
        target.contentOwnerId,
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
  ): void =>
    promptDragController.handleDragFinish({
      sourcePayload: {
        fromId: source.promptId,
        sourceFolderId: screenRootFolderId,
        sourceCategoryId: source.categoryId,
        contentKind,
        statusSection: isCompletedMode ? 'completed' : 'active'
      },
      dropPayload
    })

  const activeHeaderRowId = 'prompt-header' as const
  /** Sampled category constrained to categories owned by the current root folder. */
  const activeBreadcrumbCategory = $derived(
    isCompletedMode
      ? null
      : (categories.find((category) => category.id === breadcrumbCategoryId) ?? null)
  )
  /** Root-level content label shown when the sample point is outside a category. */
  const rootContentBreadcrumbLabel = $derived(
    isTemplateFolder ? 'Templates' : isCompletedMode ? 'Completed' : 'Prompts'
  )
  /** Current category or root-content label shown after the folder breadcrumb. */
  const activeHeaderSection = $derived(
    activeBreadcrumbCategory?.displayName ?? rootContentBreadcrumbLabel
  )

  const findRenderedPromptRow = (promptId: string): PromptFolderScreenPromptEditorRow | undefined =>
    activePromptFolderScreenRows.find(
      (row): row is PromptFolderScreenPromptEditorRow =>
        row.kind === 'prompt-editor' && row.promptId === promptId
    )

  /** Aligns the active content breadcrumb without expanding categories or selecting an editor. */
  const handleHeaderSegmentClick = () => {
    if (!scrollToWithinWindowBand) return
    /** Navigation selection representing the category or root content segment. */
    const targetRow: ActivePromptScreenRow = activeBreadcrumbCategory
      ? { kind: 'category-details', contentOwnerId: activeBreadcrumbCategory.id }
      : { kind: 'root-header', contentOwnerId: screenRootFolderId }
    setCurrentFolderSelection(targetRow, 'header', {
      forceRequest: true
    })
    /** Virtual row aligned for the selected breadcrumb segment. */
    const targetRowId = activeBreadcrumbCategory
      ? categoryEditorRowId(activeBreadcrumbCategory.id)
      : promptFolderDividerRowId(screenRootFolderId, screenRootFolderId, null)
    scrollToWithinWindowBand(
      targetRowId,
      0,
      'align-top',
      NAVIGATED_FOLDER_TOP_OFFSET_PX
    )
  }

  /** Aligns the root-folder breadcrumb at the top without changing category expansion state. */
  const handleHeaderFolderClick = () => {
    if (!scrollToWithinWindowBand) return
    setCurrentFolderSelection(
      { kind: 'root-header', contentOwnerId: screenRootFolderId },
      'header',
      { forceRequest: true }
    )
    scrollToWithinWindowBand(
      PROMPT_FOLDER_ROOT_HEADER_ROW_ID,
      0,
      'align-top',
      NAVIGATED_FOLDER_TOP_OFFSET_PX
    )
  }

  /** Updates the category owning the breadcrumb's padded viewport sample point. */
  const handleBreadcrumbCategoryChange = (categoryId: string | null): void => {
    breadcrumbCategoryId = categoryId
  }

  const handleFindMatchReveal = (match: PromptFolderFindMatch) => {
    const targetRow: ActivePromptScreenRow = {
      kind: 'prompt',
      contentOwnerId:
        findRenderedPromptRow(match.entityId)?.contentOwnerId ?? screenRootFolderId,
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

  const handleVirtualCenterRowChange = (nextCenteredRow: ActivePromptScreenRow | null) => {
    latestCenteredPromptScreenRow = nextCenteredRow
    if (hasManualSelectionSource()) return
    setCurrentFolderSelection(resolveScrollFollowRow(latestCenteredPromptScreenRow), 'scroll-follow')
  }

  const handleVirtualUserScroll = () => {
    clearManualSelectionSource()
    setCurrentFolderSelection(resolveScrollFollowRow(latestCenteredPromptScreenRow), 'scroll-follow')
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
    get completedPromptContentOwnerByPromptId(): Record<string, string> {
      return completedPromptContentOwnerByPromptId
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
    get isDetailsSectionExpanded(): boolean {
      return isDetailsSectionExpanded
    },
    get isContentSectionExpanded(): boolean {
      return isContentSectionExpanded
    },
    get detailsSectionExpandedByOwnerId(): Record<string, boolean> {
      return detailsSectionExpandedByOwnerId
    },
    get contentSectionExpandedByOwnerId(): Record<string, boolean> {
      return contentSectionExpandedByOwnerId
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
    get activeHeaderSection(): string {
      return activeHeaderSection
    },
    get breadcrumbSampleOffsetPx(): number {
      return BREADCRUMB_SAMPLE_OFFSET_PX
    },
    get loadingOverlay() {
      return loadingOverlay
    },
    get loadingOverlayFadeMs(): number {
      return LOADING_OVERLAY_FADE_MS
    },
    persistActivePromptScreenRow,
    scrollToWithinWindowBandWithManualClear,
    toggleDetailsSectionExpanded,
    toggleContentSectionExpanded,
    handleHeaderSegmentClick,
    handleHeaderFolderClick,
    handleBreadcrumbCategoryChange,
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
