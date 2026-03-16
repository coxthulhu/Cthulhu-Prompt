import { useLiveQuery } from '@tanstack/svelte-db'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { isPromptFull, type PromptFull } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import { compactGuid } from '@shared/compactGuid'
import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
import {
  getPromptNavigationContext,
  persistedPromptTreeEntryIdToPromptNavigationRow,
  promptNavigationRowToPersistedEntryId,
  type PromptNavigationRow,
  type PromptNavigationSource
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
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { loadPromptFolderInitial } from '@renderer/data/Queries/PromptFolderQuery'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import { createPrompt, deletePrompt } from '@renderer/data/Mutations/PromptMutations'
import { reorderPromptFolderPrompts } from '@renderer/data/Mutations/PromptFolderMutations'
import {
  lookupPromptFolderDescriptionMeasuredHeight,
  lookupPromptFolderScrollTop,
  recordPromptFolderScrollTop
} from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
import { setPromptFolderDraftDescription } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
import {
  lookupWorkspacePersistedPromptFolderPromptTreeEntryId,
  setPromptFolderPromptTreeEntryIdWithAutosave
} from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
import { createLoadingOverlayState } from '@renderer/common/ui/loading/loadingOverlayState.svelte.ts'
import type {
  ScrollToAndTrackRowCentered,
  ScrollToWithinWindowBand,
  VirtualWindowViewportMetrics
} from '../virtualizer/virtualWindowTypes'
import {
  PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY,
  PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
  PROMPT_FOLDER_FIND_TITLE_SECTION_KEY
} from './find/promptFolderFindSectionKeys'
import type { PromptFolderFindItem, PromptFolderFindMatch } from './find/promptFolderFindTypes'
import {
  PROMPT_FOLDER_SETTINGS_ROW_ID,
  promptEditorRowId,
  promptFolderSettingsFindEntityId
} from './promptFolderRowIds'
import { estimatePromptFolderSettingsHeight } from './promptFolderSettingsSizing'
import { SvelteDate } from 'svelte/reactivity'

export type ActivePromptTreeRow = { kind: 'folder-settings' } | { kind: 'prompt'; promptId: string }
export type PromptFocusRequest = { promptId: string; requestId: number }

type PromptFolderScreenControllerOptions = {
  getPromptFolderId: () => string
}

export const createPromptFolderScreenController = ({
  getPromptFolderId
}: PromptFolderScreenControllerOptions) => {
  const workspaceSelection = getWorkspaceSelectionContext()
  const systemSettings = getSystemSettingsContext()
  const promptNavigation = getPromptNavigationContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)
  const promptFolderId = $derived(getPromptFolderId())
  const workspaceId = $derived(workspaceSelection.selectedWorkspaceId)

  const promptFolderQuery = useLiveQuery(promptFolderCollection) as {
    data: PromptFolder[]
  }
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
  }
  const promptFolderDraftQuery = useLiveQuery(promptFolderDraftCollection) as {
    data: PromptFolderDraftRecord[]
  }

  const promptFolder = $derived.by(() => {
    return promptFolderQuery.data.find((candidate) => candidate.id === promptFolderId) ?? null
  })
  const promptDraftById = $derived.by(() => {
    const draftsById: Record<string, PromptDraftRecord> = {}
    for (const draft of promptDraftQuery.data) {
      draftsById[draft.id] = draft
    }
    return draftsById
  })
  const promptFolderDraftById = $derived.by(() => {
    const draftsById: Record<string, PromptFolderDraftRecord> = {}
    for (const draft of promptFolderDraftQuery.data) {
      draftsById[draft.id] = draft
    }
    return draftsById
  })
  const promptFolderDraft = $derived(promptFolderDraftById[promptFolderId] ?? null)
  const promptIds = $derived(promptFolder?.promptIds ?? [])
  const descriptionText = $derived(
    promptFolderDraft?.folderDescription ?? promptFolder?.folderDescription ?? ''
  )
  const folderDisplayName = $derived(promptFolder?.displayName ?? 'Prompt Folder')

  let previousPromptFolderLoadKey = $state<string | null>(null)
  let promptFolderLoadRequestId = $state(0)
  let isLoading = $state(true)
  let pendingInitialCenterRowApplyCount = $state(0)
  const LOADING_OVERLAY_FADE_MS = 125
  let shouldShowLoadingOverlay = $state(false)
  const loadingOverlay = createLoadingOverlayState({
    fadeMs: LOADING_OVERLAY_FADE_MS,
    isLoading: () =>
      shouldShowLoadingOverlay && (isLoading || pendingInitialCenterRowApplyCount > 0)
  })
  let isCreatingPrompt = $state(false)
  let errorMessage = $state<string | null>(null)

  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  const getRestoredPromptFolderScrollTop = (): number =>
    lookupPromptFolderScrollTop(promptFolderId) ?? 0

  let initialPromptFolderScrollTopPx = $state(getRestoredPromptFolderScrollTop())
  let initialPromptFolderCenterRowId = $state<string | null>(null)
  let latestCenteredPromptTreeRow = $state<ActivePromptTreeRow | null>(null)
  let scrollTopPx = $state(getRestoredPromptFolderScrollTop())
  const TOP_SCROLL_EPSILON_PX = 1

  let promptFocusRequest = $state<PromptFocusRequest | null>(null)
  let promptFocusRequestId = $state(0)
  let latestHandledSelectionVersion = $state(0)

  const visiblePromptIds = $derived.by(() => {
    if (errorMessage) {
      return []
    }

    const loadedIds: string[] = []
    for (const promptId of promptIds) {
      if (!promptDraftById[promptId]) {
        continue
      }

      const prompt = promptCollection.get(promptId)
      if (prompt && isPromptFull(prompt)) {
        loadedIds.push(promptId)
      }
    }

    return loadedIds
  })

  const isVirtualContentReady = $derived.by(() => {
    if (errorMessage) return true
    if (isLoading) return false
    if (!promptFolder) return false
    if (!promptFolderDraft?.hasLoadedInitialData) return false
    return visiblePromptIds.length === promptIds.length
  })

  const findItems = $derived.by((): PromptFolderFindItem[] => {
    const nextItems: PromptFolderFindItem[] = []
    if (!errorMessage) {
      nextItems.push({
        entityId: promptFolderSettingsFindEntityId(promptFolderId),
        rowId: PROMPT_FOLDER_SETTINGS_ROW_ID,
        sections: [
          {
            key: PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY,
            text: descriptionText
          }
        ]
      })
    }

    for (const currentPromptId of visiblePromptIds) {
      const promptDraft = promptDraftById[currentPromptId]
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
            text: promptDraft.promptText
          }
        ]
      })
    }

    return nextItems
  })

  const hasManualSelectionSource = (): boolean => {
    if (promptNavigation.selectedFolderId !== promptFolderId) {
      return false
    }

    return (
      promptNavigation.selectionSource === 'tree-click' ||
      promptNavigation.selectionSource === 'header' ||
      promptNavigation.selectionSource === 'restore-hold'
    )
  }

  const resolveScrollFollowRow = (
    nextCenteredRow: ActivePromptTreeRow | null
  ): ActivePromptTreeRow | null => {
    // Treat near-zero virtual scroll values as "top of folder" and keep tree selection on settings.
    if (scrollTopPx < TOP_SCROLL_EPSILON_PX) {
      return { kind: 'folder-settings' }
    }

    return nextCenteredRow
  }

  const clearManualSelectionSource = () => {
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
    return row.kind === 'folder-settings' ? 'folder-settings' : `prompt:${row.promptId}`
  }

  const toActivePromptTreeRow = (row: PromptNavigationRow): ActivePromptTreeRow => {
    return row === 'folder-settings'
      ? { kind: 'folder-settings' }
      : { kind: 'prompt', promptId: row.slice('prompt:'.length) }
  }

  const toPromptFolderRowId = (row: ActivePromptTreeRow): string => {
    return row.kind === 'folder-settings'
      ? PROMPT_FOLDER_SETTINGS_ROW_ID
      : promptEditorRowId(row.promptId)
  }

  const selectedNavigationRow = $derived.by((): PromptNavigationRow | null => {
    if (promptNavigation.selectedFolderId !== promptFolderId) {
      return null
    }

    return promptNavigation.selectedRow
  })

  const activePromptTreeRow = $derived.by((): ActivePromptTreeRow | null => {
    if (!selectedNavigationRow) {
      return null
    }

    return toActivePromptTreeRow(selectedNavigationRow)
  })

  const setCurrentFolderSelection = (
    nextRow: ActivePromptTreeRow | null,
    source: PromptNavigationSource,
    options: { forceVersionBump?: boolean } = {}
  ) => {
    if (!nextRow) {
      return
    }

    promptNavigation.select({
      folderId: promptFolderId,
      row: toPromptNavigationRow(nextRow),
      source,
      forceVersionBump: options.forceVersionBump ?? false
    })
  }

  const persistActivePromptTreeRow = () => {
    const selectedRow = selectedNavigationRow
    if (!selectedRow) {
      return
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return
    }

    setPromptFolderPromptTreeEntryIdWithAutosave(
      workspaceId,
      promptFolderId,
      promptNavigationRowToPersistedEntryId(selectedRow)
    )
  }

  const clearInitialPersistedScrollWait = () => {
    pendingInitialCenterRowApplyCount = 0
  }

  const handleInitialPromptFolderCenterRowApplied = () => {
    if (pendingInitialCenterRowApplyCount === 0) return
    pendingInitialCenterRowApplyCount -= 1
  }

  const scrollToWithinWindowBandWithManualClear: ScrollToWithinWindowBand = (
    rowId,
    offsetPx,
    scrollType
  ) => {
    clearManualSelectionSource()
    scrollToWithinWindowBand?.(rowId, offsetPx, scrollType)
  }

  const selectPromptTreeRowAndCenter = (nextRow: ActivePromptTreeRow): boolean => {
    if (!scrollToAndTrackRowCentered) return false
    scrollToAndTrackRowCentered(toPromptFolderRowId(nextRow))
    return true
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

    for (const promptId of cachedPromptFolder.promptIds) {
      if (!promptDraftCollection.get(promptId)) {
        return false
      }

      const prompt = promptCollection.get(promptId)
      if (!prompt || !isPromptFull(prompt)) {
        return false
      }
    }

    return true
  }

  // Side effect: load prompt-folder records and reset local screen state when folder selection changes.
  $effect(() => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) return

    const nextPromptFolderLoadKey = `${workspaceId}:${promptFolderId}`
    if (previousPromptFolderLoadKey === nextPromptFolderLoadKey) return

    previousPromptFolderLoadKey = nextPromptFolderLoadKey
    promptFolderLoadRequestId += 1
    const requestId = promptFolderLoadRequestId
    const canUseCachedData = hasCachedPromptFolderData(promptFolderId)
    const currentNavigationRow =
      promptNavigation.selectedFolderId === promptFolderId ? promptNavigation.selectedRow : null
    const hasExplicitSelection =
      currentNavigationRow !== null && promptNavigation.selectionSource !== 'scroll-follow'
    const explicitSelectionRow =
      hasExplicitSelection && currentNavigationRow
        ? toActivePromptTreeRow(currentNavigationRow)
        : null
    const persistedPromptTreeEntryId =
      !explicitSelectionRow && !canUseCachedData
        ? lookupWorkspacePersistedPromptFolderPromptTreeEntryId(workspaceId, promptFolderId)
        : null
    const persistedSelectionRow = persistedPromptTreeEntryId
      ? toActivePromptTreeRow(
          persistedPromptTreeEntryIdToPromptNavigationRow(persistedPromptTreeEntryId)
        )
      : null
    const initialSelectionRow = explicitSelectionRow ??
      (currentNavigationRow
        ? toActivePromptTreeRow(currentNavigationRow)
        : persistedSelectionRow) ?? { kind: 'folder-settings' }
    const shouldApplyInitialCenterRow = Boolean(explicitSelectionRow || persistedSelectionRow)
    const restoredScrollTop = explicitSelectionRow ? 0 : getRestoredPromptFolderScrollTop()
    const restoreSelectionSource: PromptNavigationSource =
      !explicitSelectionRow && !persistedSelectionRow && restoredScrollTop <= 0
        ? 'restore-hold'
        : 'restore'

    isLoading = !canUseCachedData
    shouldShowLoadingOverlay = !canUseCachedData
    pendingInitialCenterRowApplyCount = shouldApplyInitialCenterRow ? 1 : 0
    isCreatingPrompt = false
    errorMessage = null
    initialPromptFolderCenterRowId = shouldApplyInitialCenterRow
      ? toPromptFolderRowId(initialSelectionRow)
      : null
    initialPromptFolderScrollTopPx = restoredScrollTop
    scrollTopPx = restoredScrollTop
    latestCenteredPromptTreeRow = initialSelectionRow

    if (explicitSelectionRow && currentNavigationRow) {
      latestHandledSelectionVersion = promptNavigation.selectionVersion
    } else {
      if (!currentNavigationRow) {
        setCurrentFolderSelection(initialSelectionRow, restoreSelectionSource)
      }
      latestHandledSelectionVersion = shouldApplyInitialCenterRow
        ? promptNavigation.selectionVersion
        : 0
    }

    void (async () => {
      try {
        await loadPromptFolderInitial(workspaceId, promptFolderId)
        if (requestId !== promptFolderLoadRequestId) return
        isLoading = !hasCachedPromptFolderData(promptFolderId)
      } catch (error) {
        if (requestId !== promptFolderLoadRequestId) return
        errorMessage = error instanceof Error ? error.message : String(error)
        isLoading = false
        clearInitialPersistedScrollWait()
      }
    })()
  })

  // Side effect: react to canonical navigation changes for this folder.
  $effect(() => {
    const selectedRow = selectedNavigationRow
    if (!selectedRow) return

    const target = toActivePromptTreeRow(selectedRow)
    if (target.kind === 'prompt' && !visiblePromptIds.includes(target.promptId)) {
      return
    }

    if (promptNavigation.selectionVersion === latestHandledSelectionVersion) {
      return
    }

    const source = promptNavigation.selectionSource
    if (
      source === 'scroll-follow' ||
      source === 'find' ||
      source === 'header' ||
      source === 'restore' ||
      source === 'restore-hold'
    ) {
      latestHandledSelectionVersion = promptNavigation.selectionVersion
      return
    }

    if (!selectPromptTreeRowAndCenter(target)) return
    latestHandledSelectionVersion = promptNavigation.selectionVersion
  })

  // Side effect: normalize stale prompt selections to folder settings once rows are loaded.
  $effect(() => {
    if (!isVirtualContentReady) return
    if (!activePromptTreeRow || activePromptTreeRow.kind !== 'prompt') return
    if (visiblePromptIds.includes(activePromptTreeRow.promptId)) return

    setCurrentFolderSelection({ kind: 'folder-settings' }, 'restore', { forceVersionBump: true })
  })

  const reorderPromptIds = (
    currentPromptIds: string[],
    promptId: string,
    previousPromptId: string | null
  ): string[] | null => {
    const currentIndex = currentPromptIds.indexOf(promptId)
    if (currentIndex === -1) {
      return null
    }

    const nextPromptIds = [...currentPromptIds]
    nextPromptIds.splice(currentIndex, 1)

    if (previousPromptId == null) {
      nextPromptIds.unshift(promptId)
      return nextPromptIds
    }

    const previousIndex = nextPromptIds.indexOf(previousPromptId)
    if (previousIndex === -1) {
      return null
    }

    nextPromptIds.splice(previousIndex + 1, 0, promptId)
    return nextPromptIds
  }

  const reorderPromptInFolder = async (
    promptId: string,
    previousPromptId: string | null
  ): Promise<boolean> => {
    const currentPromptFolder = promptFolder
    if (!currentPromptFolder) {
      return false
    }

    const nextPromptIds = reorderPromptIds(
      currentPromptFolder.promptIds,
      promptId,
      previousPromptId
    )
    if (!nextPromptIds) {
      return false
    }

    return await runIpcBestEffort(
      async () => {
        await reorderPromptFolderPrompts(currentPromptFolder.id, nextPromptIds)
        return true
      },
      () => false
    )
  }

  const handleAddPrompt = async (previousPromptId: string | null) => {
    const currentPromptFolder = promptFolder
    if (!currentPromptFolder || isCreatingPrompt) {
      return
    }

    isCreatingPrompt = true
    const promptId = compactGuid(window.crypto.randomUUID())
    const now = new SvelteDate().toISOString()
    const optimisticPrompt: PromptFull = {
      id: promptId,
      title: '',
      creationDate: now,
      lastModifiedDate: now,
      promptText: '',
      promptFolderCount: currentPromptFolder.promptCount + 1,
      loadingState: 'full'
    }

    await runIpcBestEffort(async () => {
      await createPrompt(currentPromptFolder.id, optimisticPrompt, previousPromptId)
      promptFocusRequestId += 1
      promptFocusRequest = { promptId, requestId: promptFocusRequestId }
    })

    isCreatingPrompt = false
  }

  const handleDeletePrompt = (nextPromptId: string) => {
    const currentPromptFolderId = promptFolder?.id
    if (!currentPromptFolderId) {
      return
    }

    void runIpcBestEffort(async () => {
      await deletePrompt(currentPromptFolderId, nextPromptId)
    })
  }

  const handleMovePromptUp = async (nextPromptId: string): Promise<boolean> => {
    const currentPromptIds = promptFolder?.promptIds ?? []
    const currentIndex = currentPromptIds.indexOf(nextPromptId)
    if (currentIndex <= 0) {
      return false
    }

    const previousPromptId = currentIndex <= 1 ? null : currentPromptIds[currentIndex - 2]
    return await reorderPromptInFolder(nextPromptId, previousPromptId)
  }

  const handleMovePromptDown = async (nextPromptId: string): Promise<boolean> => {
    const currentPromptIds = promptFolder?.promptIds ?? []
    const currentIndex = currentPromptIds.indexOf(nextPromptId)
    if (currentIndex === -1 || currentIndex >= currentPromptIds.length - 1) {
      return false
    }

    const previousPromptId = currentPromptIds[currentIndex + 1]
    return await reorderPromptInFolder(nextPromptId, previousPromptId)
  }

  const handleDescriptionChange = (text: string, measurement: TextMeasurement) => {
    setPromptFolderDraftDescription(promptFolderId, text, measurement)
  }

  const folderSettingsHeightPx = $derived.by(() => {
    const baseHeight = estimatePromptFolderSettingsHeight(
      descriptionText,
      promptFontSize,
      promptEditorMinLines
    )

    if (!viewportMetrics) {
      return baseHeight
    }

    const measuredHeight = lookupPromptFolderDescriptionMeasuredHeight(
      promptFolderId,
      viewportMetrics.widthPx,
      viewportMetrics.devicePixelRatio
    )
    return measuredHeight ?? baseHeight
  })

  const activeHeaderRowId = $derived(
    scrollTopPx < folderSettingsHeightPx ? PROMPT_FOLDER_SETTINGS_ROW_ID : 'prompt-header'
  )
  const activeHeaderSection = $derived(
    activeHeaderRowId === 'prompt-header' ? 'Prompts' : 'Folder Settings'
  )

  const resolveHeaderSelectionRow = (
    rowId: 'folder-settings' | 'prompt-header'
  ): ActivePromptTreeRow => {
    if (rowId === 'folder-settings') {
      return { kind: 'folder-settings' }
    }

    const firstPromptId = visiblePromptIds[0]
    return firstPromptId ? { kind: 'prompt', promptId: firstPromptId } : { kind: 'folder-settings' }
  }

  const handleHeaderSegmentClick = (rowId: 'folder-settings' | 'prompt-header') => {
    if (!scrollToWithinWindowBand) return
    setCurrentFolderSelection(resolveHeaderSelectionRow(rowId), 'header', {
      forceVersionBump: true
    })
    scrollToWithinWindowBand(rowId, 0, 'minimal')
  }

  const handleFindMatchReveal = (match: PromptFolderFindMatch) => {
    const targetRow: ActivePromptTreeRow =
      match.entityId === promptFolderSettingsFindEntityId(promptFolderId)
        ? { kind: 'folder-settings' }
        : { kind: 'prompt', promptId: match.entityId }
    setCurrentFolderSelection(targetRow, 'find', { forceVersionBump: true })
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

  const setViewportMetrics = (nextViewportMetrics: VirtualWindowViewportMetrics | null) => {
    viewportMetrics = nextViewportMetrics
  }

  const handleVirtualScrollTopChange = (nextScrollTop: number) => {
    scrollTopPx = nextScrollTop
    recordPromptFolderScrollTop(promptFolderId, nextScrollTop)
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
    get promptFolderId(): string {
      return promptFolderId
    },
    get promptFontSize(): number {
      return promptFontSize
    },
    get promptEditorMinLines(): number {
      return promptEditorMinLines
    },
    get descriptionText(): string {
      return descriptionText
    },
    get folderDisplayName(): string {
      return folderDisplayName
    },
    get visiblePromptIds(): string[] {
      return visiblePromptIds
    },
    get isVirtualContentReady(): boolean {
      return isVirtualContentReady
    },
    get promptDraftById(): Record<string, PromptDraftRecord> {
      return promptDraftById
    },
    get errorMessage(): string | null {
      return errorMessage
    },
    get isCreatingPrompt(): boolean {
      return isCreatingPrompt
    },
    get promptFocusRequest(): PromptFocusRequest | null {
      return promptFocusRequest
    },
    get initialPromptFolderScrollTopPx(): number {
      return initialPromptFolderScrollTopPx
    },
    get initialPromptFolderCenterRowId(): string | null {
      return initialPromptFolderCenterRowId
    },
    get findItems(): PromptFolderFindItem[] {
      return findItems
    },
    get activeHeaderRowId(): 'folder-settings' | 'prompt-header' {
      return activeHeaderRowId
    },
    get activeHeaderSection(): 'Folder Settings' | 'Prompts' {
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
    handleHeaderSegmentClick,
    handleFindMatchReveal,
    handleAddPrompt,
    handleDeletePrompt,
    handleMovePromptUp,
    handleMovePromptDown,
    handleDescriptionChange,
    setScrollToWithinWindowBand,
    setScrollToAndTrackRowCentered,
    setViewportMetrics,
    handleVirtualScrollTopChange,
    handleInitialPromptFolderCenterRowApplied,
    handleVirtualCenterRowChange,
    handleVirtualUserScroll
  }
}

export type PromptFolderScreenController = ReturnType<typeof createPromptFolderScreenController>
