import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { getPromptLocation, getPromptStatusLocation, setPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
import { NO_TEMPLATE_LABEL, TEMPLATE_NOT_SELECTED_LABEL } from '@renderer/common/emptyStateText'
import { useLiveQuery } from '@tanstack/svelte-db'
import { SvelteSet } from 'svelte/reactivity'
import {
  getPromptStatusFolderDefinition,
  PROMPT_STATUS_FOLDER_REGISTRY,
  PromptStatusFolderId,
  isPromptFull,
  type Prompt,
  type PromptContentStatus,
  type PromptTemplateReference
} from '@shared/domain/prompt/Prompt'
import {
  isPromptTemplateFull,
  type PromptTemplate
} from '@shared/domain/prompt-template/PromptTemplate'
import {
  getCategoryOrderCategoryIds,
  type PromptCollection,
  type PromptCollectionContentKind
} from '@shared/domain/prompt-collection/PromptCollection'
import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
import {
  getPromptNavigationContext,
  persistedPromptTreeEntryIdToPromptNavigationRow,
  promptIdToPromptNavigationRow,
  promptNavigationRowToPersistedEntryId,
  type PromptContentRevealPlacement,
  type PromptNavigationRow,
  type PromptNavigationSource,
  type PromptNavigationTarget
} from '@renderer/app/PromptNavigationContext.svelte.ts'
import {
  type PromptClientStateRecord,
  promptClientStateCollection
} from '@renderer/data/Collections/PromptClientStateCollection'
import {
  type PromptCollectionClientStateRecord,
  promptCollectionClientStateCollection
} from '@renderer/data/Collections/PromptCollectionClientStateCollection'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import {
  type PromptTemplateClientStateRecord,
  promptTemplateClientStateCollection
} from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import type { Category } from '@shared/domain/category/Category'
import {
  getMarkdownContentCategoryOrder,
  getMarkdownContentIds
} from '@shared/domain/markdown-content/MarkdownContent'
import { loadPromptCollectionInitial } from '@renderer/data/Queries/PromptCollectionQuery'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import { deletePrompt } from '@renderer/data/Mutations/PromptMutations'
import {
  deletePromptTemplate
} from '@renderer/data/Mutations/PromptTemplateMutations'
import {
  lookupPromptCollectionScrollTop,
  setPromptCollectionScrollTopWithAutosave,
  lookupWorkspacePersistedPromptCollectionContentSectionExpandedState,
  lookupWorkspacePersistedPromptCollectionSelection,
  setPromptCollectionContentSectionExpandedStateWithAutosave,
  setPromptCollectionSelectedEntryIdWithAutosave
} from '@renderer/data/UiState/autosave/WorkspaceUiStateAutosave.svelte.ts'
import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
import type {
  ScrollToWithinWindowBand,
  VirtualWindowScrollApi,
  VirtualWindowViewportMetrics
} from '@renderer/common/virtual-window/virtualWindowTypes'
import {
  PROMPT_COLLECTION_FIND_BODY_SECTION_KEY,
  PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY
} from './find/promptCollectionFindSectionKeys'
import type { PromptCollectionFindItem, PromptCollectionFindMatch } from './find/promptCollectionFindTypes'
import {
  PROMPT_COLLECTION_HEADER_ROW_ID,
  promptEditorRowId,
  promptCollectionDividerRowId,
  categoryEditorRowId
} from './promptCollectionRowIds'
import {
  resolvePromptDropPreviousEntryId,
  type PromptHandleDropPayload
} from '@renderer/features/prompt-drag-drop/promptHandleDrag'
import type { PromptEditorSizingConfig } from '../prompt-editor/promptEditorSizing'
import {
  getFinalPromptCollectionScreenModeDefinition,
  PromptCollectionScreenMode
} from './promptCollectionScreenMode'
import { getPromptStatusGroupCounts } from './promptStatusGroups'
import { createBlankPromptInCollection } from './createBlankPromptInCollection'
import { createBlankPromptTemplateInCollection } from './createBlankPromptTemplateInCollection'
import {
  buildPromptCollectionScreenRows,
  type PromptCollectionDividerTarget,
  type PromptCollectionPromptTarget,
  type PromptCollectionScreenPromptEditorRow,
  type PromptCollectionScreenRow
} from './promptCollectionScreenRows'
import { collectFinalizedPrompts } from './promptCollectionCompletedPrompts'
import { getPromptDisplayTitle as getPromptTitleText } from '@shared/domain/prompt/promptFallbackTitle'
import { createPromptTreePromptDragController } from '@renderer/features/prompt-tree/promptTreeDrag'
import {
  PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX,
  PROMPT_COLLECTION_VERTICAL_BIAS_PX
} from './promptCollectionScrollOffsets'

/** Virtual prompt-collection row currently aligned with sidebar navigation. */
export type ActivePromptScreenRow =
  | { kind: 'collection-header'; contentOwnerId: string }
  | { kind: 'category-details'; contentOwnerId: string }
  | { kind: 'prompt'; contentOwnerId: string; promptId: string }

/** Samples breadcrumb ownership just below category-bias placement so navigation updates immediately. */
const BREADCRUMB_SAMPLE_OFFSET_PX = PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX + 4

type PromptMetadata = {
  status: PromptContentStatus
  finalizedAt: string | null
}

export type MarkdownContentDraftRecord = {
  id: string
  /** Attached note identity projected alongside the owner's editor data. */
  attachedNoteId?: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  text: string
  templates?: PromptTemplateReference[] | null
  templateName?: string
  templateState?: 'not-selected' | 'no-template' | 'selected'
  isEdited: boolean
}

type PromptCollectionScreenControllerOptions = {
  getScreenCollectionId: () => string
  getScreenMode: () => PromptCollectionScreenMode
}

export const createPromptCollectionScreenController = ({
  getScreenCollectionId,
  getScreenMode
}: PromptCollectionScreenControllerOptions) => {
  const workspaceSelection = getWorkspaceSelectionContext()
  const systemSettings = getSystemSettingsContext()
  const promptNavigation = getPromptNavigationContext()
  const promptEditorSizingConfig: PromptEditorSizingConfig = $derived({
    fontSize: systemSettings.promptFontSize,
    minLines: systemSettings.promptEditorMinLines,
    maxLines: systemSettings.promptEditorMaxLines
  })
  const screenCollectionId = $derived(getScreenCollectionId())
  const screenMode = $derived(getScreenMode())
  /** Final-status metadata for the selected screen mode, or null for category-ordered modes. */
  const finalModeDefinition = $derived(getFinalPromptCollectionScreenModeDefinition(screenMode))
  /** Whether the screen renders a final-status prompt list. */
  const isFinalMode = $derived(finalModeDefinition !== null)
  const workspaceId = $derived(workspaceSelection.selectedWorkspaceId)

  const promptCollectionQuery = useLiveQuery(promptCollectionsCollection) as {
    data: PromptCollection[]
  }
  const promptClientStateQuery = useLiveQuery(promptClientStateCollection) as {
    data: PromptClientStateRecord[]
  }
  const promptQuery = useLiveQuery(promptsCollection) as {
    data: Prompt[]
  }
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as {
    data: PromptTemplate[]
  }
  const promptTemplateClientStateQuery = useLiveQuery(promptTemplateClientStateCollection) as {
    data: PromptTemplateClientStateRecord[]
  }
  const promptCollectionClientStateQuery = useLiveQuery(promptCollectionClientStateCollection) as {
    data: PromptCollectionClientStateRecord[]
  }
  const categoryQuery = useLiveQuery(categoryCollection) as { data: Category[] }

  const screenCollection = $derived.by(() => {
    for (const candidate of promptCollectionQuery.data) {
      if (candidate?.id === screenCollectionId) {
        return candidate
      }
    }

    return null
  })
  const contentKind = $derived<PromptCollectionContentKind>(
    screenCollection?.kind ?? 'prompt'
  )
  const isTemplateCollection = $derived(contentKind === 'template')
  /** Session-latched prompt edit markers indexed by authoritative prompt ID. */
  const promptEditedById = $derived.by<Record<string, boolean>>(() =>
    Object.fromEntries(
      promptClientStateQuery.data.map((clientState) => [clientState.id, clientState.isEdited])
    )
  )
  /** Session-latched template edit markers indexed by authoritative template ID. */
  const promptTemplateEditedById = $derived.by<Record<string, boolean>>(() =>
    Object.fromEntries(
      promptTemplateClientStateQuery.data.map((clientState) => [clientState.id, clientState.isEdited])
    )
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
    if (!isTemplateCollection) {
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
                attachedNoteId: prompt.attachedNoteId,
                title: prompt.title,
                fallbackTitle: prompt.fallbackTitle,
                modifiedAt: prompt.modifiedAt,
                text: prompt.promptText,
                ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
                templateName:
                  prompt.templates === undefined
                    ? TEMPLATE_NOT_SELECTED_LABEL
                    : templateName === undefined
                      ? NO_TEMPLATE_LABEL
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
                  attachedNoteId: template.attachedNoteId,
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
  const promptCollectionClientStateById = $derived.by(() => {
    const clientStateById: Record<string, PromptCollectionClientStateRecord> = {}
    for (const clientState of promptCollectionClientStateQuery.data) {
      if (!clientState) {
        continue
      }

      clientStateById[clientState.id] = clientState
    }
    return clientStateById
  })
  const screenCollectionClientState = $derived(
    promptCollectionClientStateById[screenCollectionId] ?? null
  )
  /** Loaded categories indexed by stable ID. */
  const categoryById = $derived.by<Record<string, Category>>(() =>
    Object.fromEntries(categoryQuery.data.map((category) => [category.id, category]))
  )
  /** Collection-owned categories in category order. */
  const categories = $derived.by(() =>
    screenCollection && !isFinalMode
      ? getCategoryOrderCategoryIds(
          getMarkdownContentCategoryOrder(screenCollection, screenMode)
        ).flatMap((categoryId) => {
          const category = categoryById[categoryId]
          return category ? [category] : []
        })
      : []
  )
  /** Collection-owned categories in the Active collection's category ordering. */
  const managedCategories = $derived.by(() =>
    screenCollection
      ? getCategoryOrderCategoryIds(
          getMarkdownContentCategoryOrder(screenCollection, PromptStatusFolderId.Active)
        ).flatMap((categoryId) => {
          /** Loaded category associated with one Active ordering group. */
          const category = categoryById[categoryId]
          return category ? [category] : []
        })
      : []
  )
  /** Counts for every registered workflow shown in the collection filter. */
  const statusGroupCounts = $derived(getPromptStatusGroupCounts(screenCollection, isTemplateCollection ? promptTemplateQuery.data.map((template) => ({ ...template, status: template.status ?? PromptTemplateStatus.Active })) : promptQuery.data))
  /** Finalized prompts in the selected group, ordered by finalization time. */
  const selectedFinalizedPrompts = $derived.by(() => {
    if (!screenCollection || !isFinalMode) return []
    return collectFinalizedPrompts({
      collection: screenCollection,
      statusFolderId: screenMode,
      statusByPromptId: Object.fromEntries((isTemplateCollection ? promptTemplateQuery.data : promptQuery.data).map((prompt) => [prompt.id, prompt.status])),
      finalizedAtByPromptId: Object.fromEntries((isTemplateCollection ? promptTemplateQuery.data : promptQuery.data).map((prompt) => [prompt.id, prompt.finalizedAt]))
    })
  })
  /** Newest-first prompt IDs for the currently selected final status. */
  const orderedFinalizedPromptIds = $derived(
    selectedFinalizedPrompts.map(({ promptId }) => promptId)
  )
  /** Navigation owner indexed for prompts in the currently selected final status. */
  const finalizedPromptContentOwnerByPromptId = $derived.by<Record<string, string>>(() =>
    Object.fromEntries(
      selectedFinalizedPrompts.map(({ contentOwnerId, promptId }) => [promptId, contentOwnerId])
    )
  )
  const collectionDisplayName = $derived(screenCollection?.displayName ?? 'Collection')

  let previousPromptCollectionLoadKey = $state<string | null>(null)
  let promptCollectionLoadRequestId = $state(0)
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

  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  /** Seeds the virtual window from this collection's persisted status-mode offset. */
  const getRestoredPromptCollectionScrollTop = (): number =>
    workspaceId ? (lookupPromptCollectionScrollTop(workspaceId, screenCollectionId, screenMode) ?? 0) : 0

  let initialPromptCollectionScrollTopPx = $state(getRestoredPromptCollectionScrollTop())
  let latestCenteredPromptScreenRow = $state<ActivePromptScreenRow | null>(null)
  let scrollTopPx = $state(getRestoredPromptCollectionScrollTop())
  /** Category currently owning the breadcrumb's padded viewport sample point. */
  let breadcrumbCategoryId = $state<string | null>(null)
  const TOP_SCROLL_EPSILON_PX = 1

  let contentSectionExpandedStates = $state<Record<string, boolean>>({})

  const getContentSectionStateKey = (contentOwnerId: string): string =>
    `${workspaceId ?? 'no-workspace'}:${contentOwnerId}:${screenMode}`

  const lookupPersistedContentSectionExpandedState = (contentOwnerId: string): boolean => {
    if (isFinalMode) {
      return true
    }

    if (!workspaceId) {
      return true
    }

    return (
      lookupWorkspacePersistedPromptCollectionContentSectionExpandedState(workspaceId, contentOwnerId) ??
      true
    )
  }

  const getIsContentSectionExpanded = (contentOwnerId: string): boolean =>
    contentSectionExpandedStates[getContentSectionStateKey(contentOwnerId)] ??
    lookupPersistedContentSectionExpandedState(contentOwnerId)

  const contentSectionExpandedByOwnerId = $derived.by<Record<string, boolean>>(() => {
    const expandedByOwnerId: Record<string, boolean> = {}
    for (const collection of promptCollectionQuery.data) {
      if (!collection) continue
      expandedByOwnerId[collection.id] = getIsContentSectionExpanded(collection.id)
    }
    for (const category of categories) {
      expandedByOwnerId[category.id] = getIsContentSectionExpanded(category.id)
    }
    return expandedByOwnerId
  })
  const isContentSectionExpanded = $derived(
    contentSectionExpandedByOwnerId[screenCollectionId] ??
      lookupPersistedContentSectionExpandedState(screenCollectionId)
  )

  const orderedPromptCollectionScreenRows = $derived.by((): PromptCollectionScreenRow[] => {
    if (!screenCollection || isFinalMode) return []

    return buildPromptCollectionScreenRows({
      collection: screenCollection,
      statusFolderId: screenMode,
      categories,
      promptIds: isTemplateCollection
        ? promptTemplateQuery.data.map((template) => template.id)
        : promptQuery.data.flatMap((prompt) =>
            getPromptStatusFolderDefinition(prompt.status).id === screenMode ? [prompt.id] : []
          ),
      isCategoryExpanded: (categoryId) => contentSectionExpandedByOwnerId[categoryId] ?? true
    })
  })
  const orderedScreenPromptIds = $derived.by(() =>
    orderedPromptCollectionScreenRows.flatMap((row) =>
      row.kind === 'prompt-editor' ? [row.promptId] : []
    )
  )
  const allOrderedScreenPromptIds = $derived.by(() => {
    if (!screenCollection || isFinalMode) return []

    return buildPromptCollectionScreenRows({
      collection: screenCollection,
      statusFolderId: screenMode,
      categories,
      promptIds: isTemplateCollection
        ? promptTemplateQuery.data.map((template) => template.id)
        : promptQuery.data.flatMap((prompt) =>
            getPromptStatusFolderDefinition(prompt.status).id === screenMode ? [prompt.id] : []
          ),
      isCategoryExpanded: () => true
    }).flatMap((row) => (row.kind === 'prompt-editor' ? [row.promptId] : []))
  })
  const orderedPromptCount = $derived(allOrderedScreenPromptIds.length)
  const screenPromptIds = $derived(
    isFinalMode ? orderedFinalizedPromptIds : orderedScreenPromptIds
  )
  const renderedPromptIds = $derived(
    isFinalMode ? orderedFinalizedPromptIds : orderedScreenPromptIds
  )
  const promptMetadataByPromptId = $derived.by(() => {
    const metadataById: Record<string, PromptMetadata> = {}
    for (const prompt of promptQuery.data) {
      if (!prompt) continue
      metadataById[prompt.id] = {
        status: prompt.status,
        finalizedAt: prompt.finalizedAt ?? null
      }
    }
    if (isTemplateCollection) {
      for (const template of promptTemplateQuery.data) {
        metadataById[template.id] = {
          status: template.status ?? PromptTemplateStatus.Active,
          finalizedAt: template.finalizedAt ?? null
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

      const content = isTemplateCollection ? templateById[promptId] : promptById[promptId]
      if (
        content &&
        (isTemplateCollection
          ? isPromptTemplateFull(content as PromptTemplate)
          : isPromptFull(content as Prompt))
      ) {
        loadedIds.push(promptId)
      }
    }

    return loadedIds
  })

  const navigablePromptIds = $derived(
    allOrderedScreenPromptIds.filter((promptId) => {
      const content = isTemplateCollection ? templateById[promptId] : promptById[promptId]
      return Boolean(
        contentDraftById[promptId] &&
          content &&
          (isTemplateCollection
            ? isPromptTemplateFull(content as PromptTemplate)
            : isPromptFull(content as Prompt))
      )
    })
  )

  const isVirtualContentReady = $derived.by(() => {
    if (errorMessage) return true
    if (isLoading) return false
    if (!screenCollection) return false
    if (!screenCollectionClientState?.hasLoadedInitialData) return false
    return renderedPromptIds.every((promptId) => {
      const content = isTemplateCollection ? templateById[promptId] : promptById[promptId]
      return Boolean(
        contentDraftById[promptId] &&
          content &&
          (isTemplateCollection
            ? isPromptTemplateFull(content as PromptTemplate)
            : isPromptFull(content as Prompt))
      )
    })
  })

  const findItems = $derived.by((): PromptCollectionFindItem[] => {
    const nextItems: PromptCollectionFindItem[] = []

    /** Appends one loaded prompt's title and body in screen order. */
    const appendPromptFindItem = (currentPromptId: string): void => {
      const promptDraft = contentDraftById[currentPromptId]
      if (!promptDraft) return
      nextItems.push({
        entityId: currentPromptId,
        rowId: promptEditorRowId(currentPromptId),
        sections: [
          {
            key: PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY,
            text: promptDraft.title
          },
          {
            key: PROMPT_COLLECTION_FIND_BODY_SECTION_KEY,
            text: promptDraft.text
          }
        ]
      })
    }

    if (errorMessage || isFinalMode) {
      for (const currentPromptId of visiblePromptIds) {
        appendPromptFindItem(currentPromptId)
      }
      return nextItems
    }

    /** Loaded visible prompt IDs exclude unresolved screen rows from find. */
    const visiblePromptIdSet = new SvelteSet(visiblePromptIds)
    for (const row of orderedPromptCollectionScreenRows) {
      if (row.kind === 'prompt-editor') {
        if (visiblePromptIdSet.has(row.promptId)) appendPromptFindItem(row.promptId)
        continue
      }
    }

    return nextItems
  })

  const hasManualSelectionSource = (): boolean => {
    if (promptNavigation.screenCollectionId !== screenCollectionId) {
      return false
    }

    return (
      promptNavigation.selectionSource === 'tree-click' ||
      promptNavigation.selectionSource === 'find' ||
      promptNavigation.selectionSource === 'editor-interaction' ||
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
    // Treat near-zero virtual scroll values as the collection page header.
    if (scrollTopPx < TOP_SCROLL_EPSILON_PX) {
      return { kind: 'collection-header', contentOwnerId: screenCollectionId }
    }

    return nextCenteredRow
  }

  const clearManualSelectionSource = () => {
    const pendingFocus = promptNavigation.promptFocusRequests.pending
    if (
      pendingFocus?.payload.screenCollectionId === screenCollectionId &&
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

    setCurrentCollectionSelection(fallbackRow, 'scroll-follow')
  }

  const toPromptNavigationRow = (row: ActivePromptScreenRow): PromptNavigationRow => {
    return row.kind === 'prompt'
      ? `prompt:${row.promptId}`
      : row.kind === 'collection-header'
        ? 'collection-header'
        : 'category-details'
  }

  const toActivePromptScreenRow = (
    contentOwnerId: string,
    row: PromptNavigationRow
  ): ActivePromptScreenRow => {
    return row === 'collection-header'
      ? { kind: 'collection-header', contentOwnerId }
      : row === 'category-details'
        ? { kind: 'category-details', contentOwnerId }
        : { kind: 'prompt', contentOwnerId, promptId: row.slice('prompt:'.length) }
  }

  const toActivePromptScreenTarget = (target: PromptNavigationTarget): ActivePromptScreenRow =>
    toActivePromptScreenRow(target.contentOwnerId, target.row)

  const toPromptCollectionRowId = (row: ActivePromptScreenRow): string => {
    return row.kind === 'collection-header'
      ? PROMPT_COLLECTION_HEADER_ROW_ID
      : row.kind === 'category-details'
        ? categoryEditorRowId(row.contentOwnerId)
        : promptEditorRowId(row.promptId)
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

    if (!workspaceId || isFinalMode) {
      return
    }

    setPromptCollectionContentSectionExpandedStateWithAutosave(workspaceId, contentOwnerId, isExpanded)
  }

  const toggleContentSectionExpanded = (contentOwnerId: string) => {
    setContentSectionExpanded(contentOwnerId, !getIsContentSectionExpanded(contentOwnerId))
  }

  const findContentOwnerPath = (contentOwnerId: string): string[] | null => {
    if (contentOwnerId === screenCollectionId) return [screenCollectionId]
    return categoryById[contentOwnerId] ? [screenCollectionId, contentOwnerId] : null
  }

  /** Expands the main-screen sections required to reveal one navigation row. */
  const expandSectionForRow = (
    row: ActivePromptScreenRow,
    expandContent = false
  ): boolean => {
    let changed = false
    if (isFinalMode || row.kind === 'collection-header') return false

    const ownerPath = findContentOwnerPath(row.contentOwnerId) ?? []
    for (const ancestorOwnerId of ownerPath.slice(0, -1)) {
      if (!getIsContentSectionExpanded(ancestorOwnerId)) {
        setContentSectionExpanded(ancestorOwnerId, true)
        changed = true
      }
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
      promptNavigation.screenCollectionId !== screenCollectionId ||
      !promptNavigation.contentOwnerId ||
      !promptNavigation.selectedRow
    ) {
      return null
    }

    return toActivePromptScreenRow(promptNavigation.contentOwnerId, promptNavigation.selectedRow)
  })

  const activePromptScreenRow = $derived(selectedNavigationTarget)

  const setCurrentCollectionSelection = (
    nextRow: ActivePromptScreenRow | null,
    source: PromptNavigationSource,
    options: {
      forceRequest?: boolean
      contentReveal?: PromptContentRevealPlacement & {
        expandContent?: boolean
      }
      focusPromptId?: string
      treeExpansion?: 'owner' | 'ancestors'
    } = {}
  ) => {
    if (!nextRow) {
      return
    }

    promptNavigation.select({
      screenCollectionId,
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
    if (isFinalMode) {
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

    setPromptCollectionSelectedEntryIdWithAutosave(
      workspaceId,
      screenCollectionId,
      selectedTarget.contentOwnerId,
      promptNavigationRowToPersistedEntryId(toPromptNavigationRow(selectedTarget))
    )
  }

  const selectCreatedPrompt = (contentOwnerId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      screenCollectionId,
      contentOwnerId,
      row,
      source: 'prompt-divider-create',
      forceRequest: true,
      contentReveal: { scrollType: 'minimal' },
      focusPromptId: promptId
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptCollectionSelectedEntryIdWithAutosave(
        workspaceId,
        screenCollectionId,
        contentOwnerId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }
  }

  const promptDragController = createPromptTreePromptDragController({
    getPromptCollections: () => promptCollectionQuery.data
  })

  const scrollToWithinWindowBandWithManualClear: ScrollToWithinWindowBand = (
    rowId,
    offset,
    scrollType,
    scrollPaddingPx
  ) => {
    // Caret visibility adjustments must retain the editor selected by the user's input.
    if (typeof offset === 'number' && promptNavigation.selectionSource !== 'editor-interaction') {
      clearManualSelectionSource()
    }
    return scrollApi?.scrollToWithinWindowBand(rowId, offset, scrollType, scrollPaddingPx)
      ?? (() => {})
  }

  /** Selects an edited prompt without moving content or expanding sidebar categories. */
  const handlePromptInteraction = (target: PromptCollectionPromptTarget): void => {
    setCurrentCollectionSelection({
      kind: 'prompt',
      contentOwnerId: target.contentOwnerId,
      promptId: target.promptId
    }, 'editor-interaction')
  }

  const isSameNavigationTarget = (
    left: PromptNavigationTarget,
    right: PromptNavigationTarget
  ): boolean =>
    left.screenCollectionId === right.screenCollectionId &&
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
      focusRequest?.payload.screenCollectionId === target.screenCollectionId &&
      target.row === promptIdToPromptNavigationRow(focusRequest.payload.promptId)
    ) {
      promptNavigation.promptFocusRequests.cancel(focusRequest)
    }
  }

  const hasCachedPromptCollectionData = (nextPromptCollectionId: string): boolean => {
    const promptCollectionClientState = promptCollectionClientStateCollection.get(nextPromptCollectionId)
    if (!promptCollectionClientState?.hasLoadedInitialData) {
      return false
    }

    const cachedPromptCollection = promptCollectionsCollection.get(nextPromptCollectionId)
    if (!cachedPromptCollection) {
      return false
    }

    for (const promptId of getMarkdownContentIds(
      cachedPromptCollection,
      cachedPromptCollection.kind
    )) {
      if (cachedPromptCollection.kind === 'template') {
        const template = promptTemplatesCollection.get(promptId)
        if (
          !promptTemplateClientStateCollection.get(promptId) ||
          !template ||
          !isPromptTemplateFull(template)
        ) {
          return false
        }
      } else {
        const prompt = promptsCollection.get(promptId)
        if (!promptClientStateCollection.get(promptId) || !prompt || !isPromptFull(prompt)) {
          return false
        }
      }
    }

    return true
  }

  // Side effect: load prompt-collection records and reset local screen state when collection selection changes.
  $effect(() => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) return

    const nextPromptCollectionLoadKey = `${workspaceId}:${screenCollectionId}`
    if (previousPromptCollectionLoadKey === nextPromptCollectionLoadKey) return

    previousPromptCollectionLoadKey = nextPromptCollectionLoadKey
    promptCollectionLoadRequestId += 1
    const requestId = promptCollectionLoadRequestId
    const canUseCachedData = hasCachedPromptCollectionData(screenCollectionId)
    const currentNavigationTarget = selectedNavigationTarget
    /** Only an outstanding reveal is explicit navigation; a retained selection is history. */
    const hasExplicitSelection =
      currentNavigationTarget !== null &&
      promptNavigation.contentRevealRequests.pending?.payload.screenCollectionId === screenCollectionId
    const explicitSelectionTarget = hasExplicitSelection ? currentNavigationTarget : null
    /** Saved zero is a real position and must also override saved-item restoration. */
    const savedScrollTop = lookupPromptCollectionScrollTop(workspaceId, screenCollectionId, screenMode)
    const persistedSelection =
      !explicitSelectionTarget && !canUseCachedData
        ? lookupWorkspacePersistedPromptCollectionSelection(workspaceId, screenCollectionId)
        : null
    const persistedSelectionTarget = persistedSelection
      ? toActivePromptScreenRow(
          persistedSelection.contentOwnerId,
          persistedPromptTreeEntryIdToPromptNavigationRow(persistedSelection.selectedEntryId)
        )
      : null
    const initialSelectionTarget = explicitSelectionTarget ??
      currentNavigationTarget ??
      persistedSelectionTarget ?? {
        kind: 'collection-header',
        contentOwnerId: screenCollectionId
      }
    // Reveals an explicit or persisted selection after its virtual rows are first created.
    const shouldApplyInitialReveal = Boolean(
      explicitSelectionTarget || (!isFinalMode && savedScrollTop === null && persistedSelectionTarget)
    )
    const restoredScrollTop = explicitSelectionTarget ? 0 : (savedScrollTop ?? 0)
    const restoreSelectionSource: PromptNavigationSource =
      (savedScrollTop === null && persistedSelectionTarget) ||
      (!explicitSelectionTarget && restoredScrollTop <= 0)
        ? 'restore-hold'
        : 'restore'

    isLoading = !canUseCachedData
    shouldShowLoadingOverlay = !canUseCachedData
    initialContentRevealRequestId = null
    isCreatingPrompt = false
    errorMessage = null
    initialPromptCollectionScrollTopPx = restoredScrollTop
    scrollTopPx = restoredScrollTop
    latestCenteredPromptScreenRow = isFinalMode ? null : initialSelectionTarget

    if (shouldApplyInitialReveal) {
      const source = explicitSelectionTarget
        ? promptNavigation.selectionSource!
        : restoreSelectionSource
      // Preserves sidebar category alignment when navigation also opens the prompt-collection screen.
      /** Startup placement preserving category alignment while biasing prompt restoration. */
      const initialRevealPlacement: PromptContentRevealPlacement =
        initialSelectionTarget.kind === 'category-details'
          ? {
              scrollType: 'vertical-bias',
              verticalBiasPx: PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX
            }
          : {
              scrollType: 'vertical-bias',
              verticalBiasPx: PROMPT_COLLECTION_VERTICAL_BIAS_PX
            }
      const result = promptNavigation.select({
        screenCollectionId,
        contentOwnerId: initialSelectionTarget.contentOwnerId,
        row: toPromptNavigationRow(initialSelectionTarget),
        source,
        forceRequest: true,
        contentReveal: {
          ...initialRevealPlacement,
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
    } else if (!currentNavigationTarget || savedScrollTop !== null) {
      setCurrentCollectionSelection(initialSelectionTarget, restoreSelectionSource, {
        forceRequest: true
      })
    }

    void (async () => {
      try {
        await loadPromptCollectionInitial(workspaceId, screenCollectionId)
        if (requestId !== promptCollectionLoadRequestId) return
        isLoading = !hasCachedPromptCollectionData(screenCollectionId)
      } catch (error) {
        if (requestId !== promptCollectionLoadRequestId) return
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
    if (target.kind === 'collection-header') return true
    if (target.kind === 'category-details') {
      return orderedPromptCollectionScreenRows.some(
        (row) =>
          row.kind === 'category-editor' && row.contentOwnerId === target.contentOwnerId
      )
    }
    return visiblePromptIds.includes(target.promptId)
  }

  // Side effect: expand the requested content path once category rows are ready.
  $effect(() => {
    const request = promptNavigation.contentExpansionRequests.pending
    if (!request || request.payload.screenCollectionId !== screenCollectionId) return
    if (!isVirtualContentReady) return

    promptNavigation.contentExpansionRequests.consume(request, (payload) => {
      expandSectionForRow(
        toActivePromptScreenTarget(payload),
        payload.expandContent
      )
    })
  })

  // Side effect: reveal and acknowledge a requested content row once the virtual window is ready.
  $effect(() => {
    const request = promptNavigation.contentRevealRequests.pending
    if (!request || request.payload.screenCollectionId !== screenCollectionId) return
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

    if (!scrollApi) return

    promptNavigation.contentRevealRequests.consume(request, (payload) => {
      const rowId = toPromptCollectionRowId(toActivePromptScreenTarget(payload))
      if (payload.scrollType === 'center') {
        scrollApi!.scrollToAndTrackRow(rowId, { type: 'center' })
      } else if (payload.scrollType === 'vertical-bias') {
        scrollApi!.scrollToAndTrackRow(rowId, {
          type: 'vertical-bias',
          verticalBiasPx: payload.verticalBiasPx
        })
      } else {
        scrollApi!.scrollToWithinWindowBand(rowId, 0, payload.scrollType)
      }
    })
  })

  // Side effect: normalize stale prompt selections once rows are loaded.
  $effect(() => {
    if (!isVirtualContentReady) return
    if (isFinalMode) return
    if (!activePromptScreenRow || activePromptScreenRow.kind !== 'prompt') return
    if (navigablePromptIds.includes(activePromptScreenRow.promptId)) return

    setCurrentCollectionSelection(
      activePromptScreenRow.contentOwnerId === screenCollectionId
        ? { kind: 'collection-header', contentOwnerId: screenCollectionId }
        : {
            kind: 'category-details',
            contentOwnerId: activePromptScreenRow.contentOwnerId
      },
      'restore',
      { forceRequest: true }
    )
  })

  const handleAddPrompt = async (target: PromptCollectionDividerTarget) => {
    const rowOwnerCollection = promptCollectionsCollection.get(screenCollectionId)
    if (!rowOwnerCollection || isCreatingPrompt) {
      return
    }

    isCreatingPrompt = true

    if (isTemplateCollection) {
      const creation = createBlankPromptTemplateInCollection(
        rowOwnerCollection.id,
        target.previousEntryId,
        target.categoryId
      )
      selectCreatedPrompt(target.categoryId ?? rowOwnerCollection.id, creation.templateId)
      await runIpcBestEffort(() => creation.persistence)
    } else {
      const creation = createBlankPromptInCollection(
        rowOwnerCollection.id,
        target.previousEntryId,
        target.categoryId,
        screenMode
      )
      selectCreatedPrompt(target.categoryId ?? rowOwnerCollection.id, creation.promptId)
      await runIpcBestEffort(() => creation.persistence)
    }

    isCreatingPrompt = false
  }

  const handleDeletePrompt = (target: PromptCollectionPromptTarget) => {
    if (!promptCollectionsCollection.get(screenCollectionId)) {
      return
    }

    void runIpcBestEffort(async () => {
      if (isTemplateCollection) {
        await deletePromptTemplate(screenCollectionId, target.promptId)
      } else {
        await deletePrompt(screenCollectionId, target.promptId)
      }
    })
  }

  const handleSetPromptStatus = (target: PromptCollectionPromptTarget, status: PromptContentStatus) => {
    if (!promptCollectionsCollection.get(screenCollectionId)) {
      return
    }

    void runIpcBestEffort(async () => {
      await setPromptLocation(screenCollectionId, target.promptId, getPromptStatusLocation(screenCollectionId, target.promptId, status))
    })
  }

  const logicalPromptDropTargets = $derived.by<PromptHandleDropPayload[]>(() => {
    if (!screenCollection || isFinalMode) return []
    /** Linear placement targets spanning Uncategorized and every category. */
    const targets: PromptHandleDropPayload[] = []
    for (const group of getMarkdownContentCategoryOrder(screenCollection, screenMode).categories) {
      targets.push({
        collectionId: screenCollection.id,
        categoryId: group.categoryId,
        targetEntryId: null,
        position: 'after',
        statusSection: screenMode
      })
      for (const entry of group.entries) {
        targets.push({
          collectionId: screenCollection.id,
          categoryId: group.categoryId,
          targetEntryId: entry.id,
          position: 'after',
          statusSection: screenMode
        })
      }
    }
    return targets
  })

  /** Returns active content IDs for one exact category group. */
  const getCategoryEntryIds = (categoryId: string | null): string[] =>
    (screenCollection && !isFinalMode
      ? getMarkdownContentCategoryOrder(screenCollection, screenMode).categories
      : [])
      .find((group) => group.categoryId === categoryId)
      ?.entries.map((entry) => entry.id) ?? []

  const resolveAdjacentPromptMove = (
    target: PromptCollectionPromptTarget,
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
      /** Exact predecessor selected by the adjacent move button. */
      const previousEntryId = resolvePromptDropPreviousEntryId(
        target.categoryId ?? 'uncategorized',
        getCategoryEntryIds(target.categoryId),
        target.promptId,
        { ...dropTarget, collectionId: dropTarget.categoryId ?? 'uncategorized' },
        destinationEntryIds
      )
      if (previousEntryId !== undefined) {
        return {
          ...getPromptLocation(screenCollectionId, target.promptId),
          categoryId: dropTarget.categoryId ?? null,
          previousEntryId
        }
      }
    }
    return null
  }

  const canMovePrompt = (target: PromptCollectionPromptTarget, direction: 'up' | 'down'): boolean =>
    resolveAdjacentPromptMove(target, direction) !== null

  const movePromptToAdjacentTarget = async (
    target: PromptCollectionPromptTarget,
    direction: 'up' | 'down'
  ): Promise<boolean> => {
    /** Complete destination selected by the move button. */
    const location = resolveAdjacentPromptMove(target, direction)
    if (!location) return false
    scrollApi?.compensateForRowMove(
      promptEditorRowId(target.promptId),
      promptCollectionDividerRowId(
        screenCollectionId,
        target.contentOwnerId,
        target.promptId
      ),
      promptCollectionDividerRowId(
        screenCollectionId,
        location.categoryId ?? screenCollectionId,
        location.previousEntryId
      )
    )
    /** Navigation changes only after the shared location mutation succeeds. */
    const didMove = await runIpcBestEffort(async () => {
      await setPromptLocation(screenCollectionId, target.promptId, location)
      return true
    }, () => false)
    if (didMove) {
      handlePromptInteraction({
        ...target,
        categoryId: location.categoryId,
        contentOwnerId: location.categoryId ?? screenCollectionId
      })
    }
    return didMove
  }

  const handleMovePromptUp = (target: PromptCollectionPromptTarget): Promise<boolean> =>
    movePromptToAdjacentTarget(target, 'up')

  const handleMovePromptDown = (target: PromptCollectionPromptTarget): Promise<boolean> =>
    movePromptToAdjacentTarget(target, 'down')

  const handlePromptTreeDrop = (
    source: PromptCollectionPromptTarget,
    dropPayload: PromptHandleDropPayload | null
  ): void =>
    promptDragController.handleDragFinish({
      sourcePayload: {
        fromId: source.promptId,
        location: getPromptLocation(screenCollectionId, source.promptId),
        contentKind
      },
      dropPayload
    })

  const activeHeaderRowId = 'prompt-header' as const
  /** Sampled category constrained to categories owned by the current collection. */
  const activeBreadcrumbCategory = $derived(
    isFinalMode
      ? null
      : (categories.find((category) => category.id === breadcrumbCategoryId) ?? null)
  )
  /** Fixed status-group or template label shown before the current category. */
  const headerGroupLabel = $derived(
    PROMPT_STATUS_FOLDER_REGISTRY[screenMode].label
  )

  const findRenderedPromptRow = (promptId: string): PromptCollectionScreenPromptEditorRow | undefined =>
    orderedPromptCollectionScreenRows.find(
      (row): row is PromptCollectionScreenPromptEditorRow =>
        row.kind === 'prompt-editor' && row.promptId === promptId
    )

  /** Aligns the current category without expanding it or selecting an editor. */
  const handleHeaderCategoryClick = () => {
    if (!scrollApi) return
    setCurrentCollectionSelection(
      { kind: 'category-details', contentOwnerId: activeBreadcrumbCategory!.id },
      'header',
      { forceRequest: true }
    )
    scrollApi.scrollToAndTrackRow(categoryEditorRowId(activeBreadcrumbCategory!.id), {
      type: 'vertical-bias',
      verticalBiasPx: PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX
    })
  }

  /** Returns collection and group breadcrumb clicks to the top without changing category expansion. */
  const handleHeaderCollectionClick = () => {
    if (!scrollApi) return
    setCurrentCollectionSelection(
      { kind: 'collection-header', contentOwnerId: screenCollectionId },
      'header',
      { forceRequest: true }
    )
    scrollApi.scrollToAndTrackRow(PROMPT_COLLECTION_HEADER_ROW_ID, {
      type: 'vertical-bias',
      verticalBiasPx: PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX
    })
  }

  /** Updates the category owning the breadcrumb's padded viewport sample point. */
  const handleBreadcrumbCategoryChange = (categoryId: string | null): void => {
    breadcrumbCategoryId = categoryId
  }

  /** Selects a find target and expands its content immediately without scrolling the main viewport. */
  const handleFindMatchReveal = (match: PromptCollectionFindMatch) => {
    /** Navigation target for the prompt owning this collection-level find match. */
    const targetRow: ActivePromptScreenRow = {
      kind: 'prompt',
      contentOwnerId:
        findRenderedPromptRow(match.entityId)?.contentOwnerId ?? screenCollectionId,
      promptId: match.entityId
    }
    setCurrentCollectionSelection(targetRow, 'find', {
      forceRequest: true,
      treeExpansion: 'owner'
    })
    expandSectionForRow(targetRow)
  }

  const setScrollApi = (nextScrollApi: VirtualWindowScrollApi | null) => {
    scrollApi = nextScrollApi
  }

  const setViewportMetrics = (nextViewportMetrics: VirtualWindowViewportMetrics | null) => {
    viewportMetrics = nextViewportMetrics
  }

  /** Persists actual virtual offsets, including clamping and explicit navigation results. */
  const handleVirtualScrollTopChange = (nextScrollTop: number) => {
    scrollTopPx = nextScrollTop
    if (!workspaceId) return
    setPromptCollectionScrollTopWithAutosave(workspaceId, screenCollectionId, screenMode, nextScrollTop)
  }

  /** Copies the visible offset to the destination before the header tab remounts the screen. */
  const preserveScrollForScreenMode = (nextMode: PromptCollectionScreenMode): void => {
    if (!workspaceId || nextMode === screenMode) return
    setPromptCollectionScrollTopWithAutosave(
      workspaceId, screenCollectionId, nextMode, scrollApi?.getScrollTop() ?? scrollTopPx
    )
  }

  const handleVirtualCenterRowChange = (nextCenteredRow: ActivePromptScreenRow | null) => {
    latestCenteredPromptScreenRow = nextCenteredRow
    if (hasManualSelectionSource()) return
    setCurrentCollectionSelection(resolveScrollFollowRow(latestCenteredPromptScreenRow), 'scroll-follow')
  }

  const handleVirtualUserScroll = () => {
    clearManualSelectionSource()
    setCurrentCollectionSelection(resolveScrollFollowRow(latestCenteredPromptScreenRow), 'scroll-follow')
  }

  return {
    get workspaceId(): string | null {
      return workspaceId
    },
    get screenCollectionId(): string {
      return screenCollectionId
    },
    get promptEditorSizingConfig(): PromptEditorSizingConfig {
      return promptEditorSizingConfig
    },
    get contentKind(): PromptCollectionContentKind {
      return contentKind
    },
    get collectionDisplayName(): string {
      return collectionDisplayName
    },
    get screenCollection(): PromptCollection | null {
      return screenCollection
    },
    get promptCollections(): PromptCollection[] {
      return promptCollectionQuery.data.filter(
        (currentPromptCollection): currentPromptCollection is PromptCollection =>
          currentPromptCollection !== undefined
      )
    },
    get categories(): Category[] {
      return categories
    },
    get managedCategories(): Category[] {
      return managedCategories
    },
    get orderedPromptCollectionScreenRows(): PromptCollectionScreenRow[] {
      return orderedPromptCollectionScreenRows
    },
    get visiblePromptIds(): string[] {
      return visiblePromptIds
    },
    get orderedPromptCount(): number {
      return orderedPromptCount
    },
    /** Counts used by every registry-backed filter. */
    get statusGroupCounts(): Record<PromptStatusFolderId, number> {
      return statusGroupCounts
    },
    get finalizedPromptContentOwnerByPromptId(): Record<string, string> {
      return finalizedPromptContentOwnerByPromptId
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
    get isContentSectionExpanded(): boolean {
      return isContentSectionExpanded
    },
    get contentSectionExpandedByOwnerId(): Record<string, boolean> {
      return contentSectionExpandedByOwnerId
    },
    get initialPromptCollectionScrollTopPx(): number {
      return initialPromptCollectionScrollTopPx
    },
    get findItems(): PromptCollectionFindItem[] {
      return findItems
    },
    get activeHeaderRowId(): 'prompt-header' {
      return activeHeaderRowId
    },
    /** Fixed breadcrumb label for the selected status group or templates. */
    get headerGroupLabel(): string {
      return headerGroupLabel
    },
    /** Optional category segment for the current viewport position. */
    get headerCategoryLabel(): string | null {
      return activeBreadcrumbCategory?.displayName ?? null
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
    toggleContentSectionExpanded,
    handleHeaderCategoryClick,
    handleHeaderCollectionClick,
    handleBreadcrumbCategoryChange,
    handleFindMatchReveal,
    handleAddPrompt,
    handlePromptInteraction,
    handleDeletePrompt,
    handleSetPromptStatus,
    handleMovePromptUp,
    handleMovePromptDown,
    canMovePrompt,
    handlePromptTreeDrop,
    setScrollApi,
    setViewportMetrics,
    handleVirtualScrollTopChange,
    preserveScrollForScreenMode,
    handleVirtualCenterRowChange,
    handleVirtualUserScroll
  }
}

export type PromptCollectionScreenController = ReturnType<typeof createPromptCollectionScreenController>
