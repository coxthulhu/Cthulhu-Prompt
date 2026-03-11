import { useLiveQuery } from '@tanstack/svelte-db'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { isPromptFull, type PromptFull } from '@shared/Prompt'
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
  promptCollection
} from '@renderer/data/Collections/PromptCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { loadPromptFolderInitial } from '@renderer/data/Queries/PromptFolderQuery'
import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
import { createPrompt, deletePrompt } from '@renderer/data/Mutations/PromptMutations'
import { reorderPromptFolderPrompts } from '@renderer/data/Mutations/PromptFolderMutations'
import {
  clearPromptTreeJumpRequest,
  lookupPromptFolderDescriptionMeasuredHeight,
  lookupPromptFolderPromptTreeActiveRow,
  lookupPromptFolderScrollTop,
  lookupPromptTreeJumpRequest,
  recordPromptFolderPromptTreeActiveRow,
  recordPromptFolderScrollTop,
  type PromptTreeJumpTarget
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
import type { PromptFolderFindItem } from './find/promptFolderFindTypes'
import {
  PROMPT_FOLDER_SETTINGS_ROW_ID,
  persistedPromptTreeEntryIdToPromptFolderRowId,
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
    isLoading: () => shouldShowLoadingOverlay && (isLoading || pendingInitialCenterRowApplyCount > 0)
  })
  let isCreatingPrompt = $state(false)
  let errorMessage = $state<string | null>(null)

  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  const getRestoredPromptFolderScrollTop = (): number => lookupPromptFolderScrollTop(promptFolderId) ?? 0
  const getRestoredActivePromptTreeRow = (): ActivePromptTreeRow | null =>
    lookupPromptFolderPromptTreeActiveRow(promptFolderId)

  let initialPromptFolderScrollTopPx = $state(getRestoredPromptFolderScrollTop())
  let initialPromptFolderCenterRowId = $state<string | null>(null)
  let activePromptTreeRow = $state<ActivePromptTreeRow | null>(
    getRestoredActivePromptTreeRow() ?? { kind: 'folder-settings' }
  )
  let latestCenteredPromptTreeRow = $state<ActivePromptTreeRow | null>(getRestoredActivePromptTreeRow())
  // Manual selection keeps the prompt tree highlight on the clicked row until the user scrolls.
  let promptTreeManualSelectionActive = $state(getRestoredPromptFolderScrollTop() <= 0)
  let scrollTopPx = $state(getRestoredPromptFolderScrollTop())

  let promptFocusRequest = $state<PromptFocusRequest | null>(null)
  let promptFocusRequestId = $state(0)
  let pendingImmediateTreeJumpTarget = $state<ActivePromptTreeRow | null>(null)

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

  const clearPromptTreeManualSelection = () => {
    promptTreeManualSelectionActive = false
  }

  const toPersistedPromptTreeEntryId = (row: ActivePromptTreeRow): string => {
    return row.kind === 'folder-settings' ? PROMPT_FOLDER_SETTINGS_ROW_ID : row.promptId
  }

  const toActivePromptTreeRow = (target: PromptTreeJumpTarget): ActivePromptTreeRow => {
    return target.kind === 'folder-settings'
      ? { kind: 'folder-settings' }
      : { kind: 'prompt', promptId: target.promptId }
  }

  const toPromptFolderRowId = (row: ActivePromptTreeRow): string => {
    return row.kind === 'folder-settings' ? PROMPT_FOLDER_SETTINGS_ROW_ID : promptEditorRowId(row.promptId)
  }

  const setActivePromptTreeRow = (
    nextRow: ActivePromptTreeRow | null,
    options: { persistWorkspace?: boolean } = {}
  ) => {
    activePromptTreeRow = nextRow
    recordPromptFolderPromptTreeActiveRow(promptFolderId, nextRow)

    if (options.persistWorkspace === false || !nextRow) {
      return
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return
    }

    setPromptFolderPromptTreeEntryIdWithAutosave(
      workspaceId,
      promptFolderId,
      toPersistedPromptTreeEntryId(nextRow)
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
    clearPromptTreeManualSelection()
    scrollToWithinWindowBand?.(rowId, offsetPx, scrollType)
  }

  const selectPromptTreeRowAndCenter = (nextRow: ActivePromptTreeRow): boolean => {
    if (!scrollToAndTrackRowCentered) return false
    promptTreeManualSelectionActive = true
    setActivePromptTreeRow(nextRow)
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
    const treeJumpRequest = lookupPromptTreeJumpRequest(promptFolderId)
    const initialTreeJumpEntryId =
      treeJumpRequest?.mode === 'initial'
        ? treeJumpRequest.target.kind === 'folder-settings'
          ? PROMPT_FOLDER_SETTINGS_ROW_ID
          : treeJumpRequest.target.promptId
        : null
    const persistedPromptTreeEntryId = !initialTreeJumpEntryId && !canUseCachedData
      ? lookupWorkspacePersistedPromptFolderPromptTreeEntryId(workspaceId, promptFolderId)
      : null
    const initialPromptTreeEntryId = initialTreeJumpEntryId ?? persistedPromptTreeEntryId
    const shouldApplyInitialPromptTreeEntry = Boolean(initialPromptTreeEntryId)
    const shouldApplyPersistedPromptTreeEntry = Boolean(persistedPromptTreeEntryId)
    const initialPromptTreeRow: ActivePromptTreeRow | null = initialPromptTreeEntryId
      ? initialPromptTreeEntryId === PROMPT_FOLDER_SETTINGS_ROW_ID
        ? { kind: 'folder-settings' }
        : { kind: 'prompt', promptId: initialPromptTreeEntryId }
      : null
    if (treeJumpRequest?.mode === 'initial') {
      clearPromptTreeJumpRequest(promptFolderId)
    }
    isLoading = !canUseCachedData
    shouldShowLoadingOverlay = !canUseCachedData
    pendingInitialCenterRowApplyCount = shouldApplyInitialPromptTreeEntry ? 1 : 0
    isCreatingPrompt = false
    errorMessage = null
    initialPromptFolderCenterRowId = initialPromptTreeEntryId
      ? persistedPromptTreeEntryIdToPromptFolderRowId(initialPromptTreeEntryId)
      : null
    const restoredScrollTop = getRestoredPromptFolderScrollTop()
    const restoredActivePromptTreeRow =
      initialPromptTreeRow ?? getRestoredActivePromptTreeRow() ?? { kind: 'folder-settings' }
    initialPromptFolderScrollTopPx = restoredScrollTop
    scrollTopPx = restoredScrollTop
    latestCenteredPromptTreeRow = restoredActivePromptTreeRow
    promptTreeManualSelectionActive =
      treeJumpRequest?.mode === 'initial'
        ? true
        : shouldApplyPersistedPromptTreeEntry
          ? false
          : restoredScrollTop <= 0
    pendingImmediateTreeJumpTarget = null
    setActivePromptTreeRow(restoredActivePromptTreeRow, { persistWorkspace: false })

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

  // Side effect: consume same-folder prompt tree clicks and queue them for imperative row centering.
  $effect(() => {
    const treeJumpRequest = lookupPromptTreeJumpRequest(promptFolderId)
    if (!treeJumpRequest || treeJumpRequest.mode !== 'immediate') return
    pendingImmediateTreeJumpTarget = toActivePromptTreeRow(treeJumpRequest.target)
    clearPromptTreeJumpRequest(promptFolderId)
  })

  // Side effect: apply queued same-folder prompt tree clicks once virtual scroll APIs and rows are ready.
  $effect(() => {
    const target = pendingImmediateTreeJumpTarget
    if (!target || !scrollToAndTrackRowCentered) return
    if (target.kind === 'prompt' && !visiblePromptIds.includes(target.promptId)) return
    if (!selectPromptTreeRowAndCenter(target)) return
    pendingImmediateTreeJumpTarget = null
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

  const handleHeaderSegmentClick = (rowId: 'folder-settings' | 'prompt-header') => {
    if (!scrollToWithinWindowBand) return
    clearPromptTreeManualSelection()
    scrollToWithinWindowBand(rowId, 0, 'minimal')
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

  const handleVirtualCenterRowChange = (nextCenteredRow: ActivePromptTreeRow | null) => {
    latestCenteredPromptTreeRow = nextCenteredRow
    if (promptTreeManualSelectionActive) return
    setActivePromptTreeRow(latestCenteredPromptTreeRow)
  }

  const handleVirtualUserScroll = () => {
    clearPromptTreeManualSelection()
    if (latestCenteredPromptTreeRow) {
      setActivePromptTreeRow(latestCenteredPromptTreeRow)
    }
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
    get activePromptTreeRow(): ActivePromptTreeRow | null {
      return activePromptTreeRow
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
