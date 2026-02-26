import { useLiveQuery } from '@tanstack/svelte-db'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import type { Prompt } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import { compactGuid } from '@shared/compactGuid'
import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
import {
  type PromptDraftRecord,
  promptDraftCollection
} from '@renderer/data/Collections/PromptDraftCollection'
import {
  type PromptFolderDraftRecord,
  promptFolderDraftCollection
} from '@renderer/data/Collections/PromptFolderDraftCollection'
import {
  USER_PERSISTENCE_DRAFT_ID,
  userPersistenceDraftCollection
} from '@renderer/data/Collections/UserPersistenceDraftCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { loadPromptFolderInitial } from '@renderer/data/Queries/PromptFolderQuery'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import { createPrompt, deletePrompt } from '@renderer/data/Mutations/PromptMutations'
import { reorderPromptFolderPrompts } from '@renderer/data/Mutations/PromptFolderMutations'
import {
  lookupPromptFolderDescriptionMeasuredHeight,
  lookupPromptFolderOutlinerActiveRow,
  lookupPromptFolderOutlinerScrollTop,
  lookupPromptFolderScrollTop,
  recordPromptFolderOutlinerActiveRow,
  recordPromptFolderOutlinerScrollTop,
  recordPromptFolderScrollTop
} from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
import { setPromptFolderDraftDescription } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
import { setPromptOutlinerWidthWithAutosave } from '@renderer/data/UiState/UserPersistenceAutosave.svelte.ts'
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
import type { PromptFolderFindItem } from './find/promptFolderFindTypes'
import { promptEditorRowId, promptFolderSettingsFindEntityId } from './promptFolderRowIds'
import { estimatePromptFolderSettingsHeight } from './promptFolderSettingsSizing'
import { SvelteDate } from 'svelte/reactivity'

export type ActiveOutlinerRow = { kind: 'folder-settings' } | { kind: 'prompt'; promptId: string }
export type PromptFocusRequest = { promptId: string; requestId: number }

type PromptFolderScreenControllerOptions = {
  getPromptFolderId: () => string
}

export const createPromptFolderScreenController = ({
  getPromptFolderId
}: PromptFolderScreenControllerOptions) => {
  const workspaceSelection = getWorkspaceSelectionContext()
  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)
  const promptFolderId = $derived(getPromptFolderId())

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
  const LOADING_OVERLAY_FADE_MS = 125
  let shouldShowLoadingOverlay = $state(false)
  const loadingOverlay = createLoadingOverlayState({
    fadeMs: LOADING_OVERLAY_FADE_MS,
    isLoading: () => shouldShowLoadingOverlay && isLoading
  })
  let isCreatingPrompt = $state(false)
  let errorMessage = $state<string | null>(null)

  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  const getRestoredPromptFolderScrollTop = (): number => lookupPromptFolderScrollTop(promptFolderId) ?? 0
  const getRestoredOutlinerScrollTop = (): number =>
    lookupPromptFolderOutlinerScrollTop(promptFolderId) ?? 0
  const getRestoredActiveOutlinerRow = (): ActiveOutlinerRow | null =>
    lookupPromptFolderOutlinerActiveRow(promptFolderId)

  let initialPromptFolderScrollTopPx = $state(getRestoredPromptFolderScrollTop())
  let initialOutlinerScrollTopPx = $state(getRestoredOutlinerScrollTop())
  let activeOutlinerRow = $state<ActiveOutlinerRow | null>(
    getRestoredActiveOutlinerRow() ?? { kind: 'folder-settings' }
  )
  let latestCenteredOutlinerRow = $state<ActiveOutlinerRow | null>(getRestoredActiveOutlinerRow())
  // Manual selection keeps the outliner highlight on the clicked row until the user scrolls.
  let outlinerManualSelectionActive = $state(getRestoredPromptFolderScrollTop() <= 0)
  let outlinerAutoScrollRequestId = $state(0)
  const getUserPersistenceDraft = () => userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)!
  const promptOutlinerDefaultWidthPx = getUserPersistenceDraft().promptOutlinerWidthPx
  let sidebarWidthPx = $state(promptOutlinerDefaultWidthPx)
  let scrollTopPx = $state(getRestoredPromptFolderScrollTop())

  let promptFocusRequest = $state<PromptFocusRequest | null>(null)
  let promptFocusRequestId = $state(0)

  const visiblePromptIds = $derived.by(() => {
    if (errorMessage) {
      return []
    }

    const idsWithDrafts: string[] = []
    for (const promptId of promptIds) {
      if (promptDraftById[promptId]) {
        idsWithDrafts.push(promptId)
      }
    }

    return idsWithDrafts
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
        rowId: 'folder-settings',
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

  const clearOutlinerManualSelection = () => {
    outlinerManualSelectionActive = false
  }

  const setActiveOutlinerRow = (nextRow: ActiveOutlinerRow | null) => {
    activeOutlinerRow = nextRow
    recordPromptFolderOutlinerActiveRow(promptFolderId, nextRow)
  }

  const scrollToWithinWindowBandWithManualClear: ScrollToWithinWindowBand = (
    rowId,
    offsetPx,
    scrollType
  ) => {
    clearOutlinerManualSelection()
    scrollToWithinWindowBand?.(rowId, offsetPx, scrollType)
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
    isLoading = !canUseCachedData
    shouldShowLoadingOverlay = !canUseCachedData
    isCreatingPrompt = false
    errorMessage = null
    const restoredScrollTop = getRestoredPromptFolderScrollTop()
    const restoredOutlinerScrollTop = getRestoredOutlinerScrollTop()
    const restoredActiveOutlinerRow = getRestoredActiveOutlinerRow() ?? { kind: 'folder-settings' }
    initialPromptFolderScrollTopPx = restoredScrollTop
    initialOutlinerScrollTopPx = restoredOutlinerScrollTop
    scrollTopPx = restoredScrollTop
    latestCenteredOutlinerRow = restoredActiveOutlinerRow
    outlinerManualSelectionActive = restoredScrollTop <= 0
    setActiveOutlinerRow(restoredActiveOutlinerRow)

    void (async () => {
      try {
        await loadPromptFolderInitial(workspaceId, promptFolderId)
        if (requestId !== promptFolderLoadRequestId) return
        isLoading = false
      } catch (error) {
        if (requestId !== promptFolderLoadRequestId) return
        errorMessage = error instanceof Error ? error.message : String(error)
        isLoading = false
      }
    })()
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

    const nextPromptIds = reorderPromptIds(currentPromptFolder.promptIds, promptId, previousPromptId)
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

  const handleOutlinerClick = (nextPromptId: string) => {
    if (!scrollToAndTrackRowCentered) return
    outlinerManualSelectionActive = true
    setActiveOutlinerRow({ kind: 'prompt', promptId: nextPromptId })
    outlinerAutoScrollRequestId += 1
    scrollToAndTrackRowCentered(promptEditorRowId(nextPromptId))
  }

  const handleOutlinerFolderSettingsClick = () => {
    if (!scrollToAndTrackRowCentered) return
    outlinerManualSelectionActive = true
    setActiveOutlinerRow({ kind: 'folder-settings' })
    outlinerAutoScrollRequestId += 1
    scrollToAndTrackRowCentered('folder-settings')
  }

  const handleAddPrompt = async (previousPromptId: string | null) => {
    const currentPromptFolder = promptFolder
    if (!currentPromptFolder || isCreatingPrompt) {
      return
    }

    isCreatingPrompt = true
    const promptId = compactGuid(window.crypto.randomUUID())
    const now = new SvelteDate().toISOString()
    const optimisticPrompt: Prompt = {
      id: promptId,
      title: '',
      creationDate: now,
      lastModifiedDate: now,
      promptText: '',
      promptFolderCount: currentPromptFolder.promptCount + 1
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
    scrollTopPx < folderSettingsHeightPx ? 'folder-settings' : 'prompt-header'
  )
  const activeHeaderSection = $derived(
    activeHeaderRowId === 'prompt-header' ? 'Prompts' : 'Folder Settings'
  )

  const handleHeaderSegmentClick = (rowId: 'folder-settings' | 'prompt-header') => {
    if (!scrollToWithinWindowBand) return
    clearOutlinerManualSelection()
    scrollToWithinWindowBand(rowId, 0, 'minimal')
  }

  const setSidebarWidth = (nextWidth: number) => {
    sidebarWidthPx = nextWidth
  }

  const setPromptOutlinerDesiredWidth = (nextDesiredWidth: number) => {
    setPromptOutlinerWidthWithAutosave(nextDesiredWidth)
  }

  const setScrollToWithinWindowBand = (nextScrollToWithinWindowBand: ScrollToWithinWindowBand | null) => {
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

  const handleOutlinerScrollTopChange = (nextScrollTop: number) => {
    recordPromptFolderOutlinerScrollTop(promptFolderId, nextScrollTop)
  }

  const handleVirtualCenterRowChange = (nextCenteredRow: ActiveOutlinerRow | null) => {
    latestCenteredOutlinerRow = nextCenteredRow
    if (outlinerManualSelectionActive) return
    setActiveOutlinerRow(latestCenteredOutlinerRow)
  }

  const handleVirtualUserScroll = () => {
    clearOutlinerManualSelection()
    outlinerAutoScrollRequestId += 1
    if (latestCenteredOutlinerRow) {
      setActiveOutlinerRow(latestCenteredOutlinerRow)
    }
  }

  return {
    get promptFolderId(): string {
      return promptFolderId
    },
    get promptFontSize(): number {
      return promptFontSize
    },
    get promptEditorMinLines(): number {
      return promptEditorMinLines
    },
    get promptOutlinerDefaultWidthPx(): number {
      return promptOutlinerDefaultWidthPx
    },
    get sidebarWidthPx(): number {
      return sidebarWidthPx
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
    get initialOutlinerScrollTopPx(): number {
      return initialOutlinerScrollTopPx
    },
    get activeOutlinerRow(): ActiveOutlinerRow | null {
      return activeOutlinerRow
    },
    get outlinerAutoScrollRequestId(): number {
      return outlinerAutoScrollRequestId
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
    scrollToWithinWindowBandWithManualClear,
    handleHeaderSegmentClick,
    handleOutlinerClick,
    handleOutlinerFolderSettingsClick,
    handleAddPrompt,
    handleDeletePrompt,
    handleMovePromptUp,
    handleMovePromptDown,
    handleDescriptionChange,
    setSidebarWidth,
    setPromptOutlinerDesiredWidth,
    setScrollToWithinWindowBand,
    setScrollToAndTrackRowCentered,
    setViewportMetrics,
    handleVirtualScrollTopChange,
    handleOutlinerScrollTopChange,
    handleVirtualCenterRowChange,
    handleVirtualUserScroll
  }
}

export type PromptFolderScreenController = ReturnType<typeof createPromptFolderScreenController>
