import { useLiveQuery } from '@tanstack/svelte-db'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { isPromptFull, type Prompt, PromptStatus } from '@shared/Prompt'
import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  copyPromptFolderSettings,
  createEmptyPromptFolderSettings,
  type PromptFolder,
  type PromptFolderSettings,
  type PromptFolderSettingsField
} from '@shared/PromptFolder'
import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
import {
  getPromptNavigationContext,
  persistedPromptTreeEntryIdToPromptNavigationRow,
  promptIdToPromptNavigationRow,
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
import {
  deletePrompt,
  movePrompt,
  setPromptStatus
} from '@renderer/data/Mutations/PromptMutations'
import {
  lookupPromptFolderSettingsRowMeasuredHeight,
  lookupPromptFolderScrollTop,
  recordPromptFolderScrollTop
} from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
import {
  setPromptFolderDraftSettingsField,
  type PromptFolderSettingsDraftField
} from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
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
  PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS,
  PROMPT_FOLDER_FIND_TITLE_SECTION_KEY
} from './find/promptFolderFindSectionKeys'
import type { PromptFolderFindItem, PromptFolderFindMatch } from './find/promptFolderFindTypes'
import {
  PROMPT_FOLDER_SETTINGS_ROW_ID,
  isPromptFolderSettingsFindEntityId,
  promptEditorRowId,
  promptFolderSettingsFindEntityId
} from './promptFolderRowIds'
import {
  estimatePromptFolderSettingsFieldRowHeight,
  getPromptFolderEditorCollapsedCardRowHeightPx,
  getPromptFolderEditorCardRowHeightPx
} from './promptFolderSettingsSizing'
import {
  resolvePromptHandleDropMove,
  type PromptHandleDropPayload
} from '../drag-drop/promptHandleDrag'
import type { PromptEditorSizingConfig } from '../prompt-editor/promptEditorSizing'
import { PromptFolderScreenMode } from './promptFolderScreenMode'
import { createBlankPromptInFolder } from './createBlankPromptInFolder'

export type ActivePromptTreeRow = { kind: 'folder-settings' } | { kind: 'prompt'; promptId: string }
export type PromptFocusRequest = { promptId: string; requestId: number }

type PromptMetadata = {
  status: PromptStatus
  completedAt: string | null
}

type PromptFolderScreenControllerOptions = {
  getPromptFolderId: () => string
  getScreenMode: () => PromptFolderScreenMode
  onPromptFolderSelect: (promptFolderId: string) => void
}

export const createPromptFolderScreenController = ({
  getPromptFolderId,
  getScreenMode,
  onPromptFolderSelect
}: PromptFolderScreenControllerOptions) => {
  const workspaceSelection = getWorkspaceSelectionContext()
  const systemSettings = getSystemSettingsContext()
  const promptNavigation = getPromptNavigationContext()
  const promptEditorSizingConfig: PromptEditorSizingConfig = $derived({
    fontSize: systemSettings.promptFontSize,
    minLines: systemSettings.promptEditorMinLines,
    maxLines: systemSettings.promptEditorMaxLines
  })
  const promptFolderId = $derived(getPromptFolderId())
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
  const promptFolderDraftQuery = useLiveQuery(promptFolderDraftCollection) as {
    data: PromptFolderDraftRecord[]
  }

  const promptFolder = $derived.by(() => {
    for (const candidate of promptFolderQuery.data) {
      if (candidate?.id === promptFolderId) {
        return candidate
      }
    }

    return null
  })
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
  const promptFolderDraft = $derived(promptFolderDraftById[promptFolderId] ?? null)
  const getPromptIdsForFolder = (folder: PromptFolder): string[] =>
    folder.entryIds.filter((entryId) => promptById[entryId])
  const promptIds = $derived(promptFolder ? getPromptIdsForFolder(promptFolder) : [])
  const completedPromptIds = $derived(promptFolder?.completedPromptIds ?? [])
  const orderedCompletedPromptIds = $derived.by(() =>
    [...completedPromptIds].sort((leftPromptId, rightPromptId) => {
      const leftCompletedAt = promptById[leftPromptId]?.completedAt ?? ''
      const rightCompletedAt = promptById[rightPromptId]?.completedAt ?? ''
      return rightCompletedAt.localeCompare(leftCompletedAt)
    })
  )
  const screenPromptIds = $derived(isCompletedMode ? orderedCompletedPromptIds : promptIds)
  const promptMetadataByPromptId = $derived.by(() => {
    const metadataById: Record<string, PromptMetadata> = {}
    for (const promptId of screenPromptIds) {
      const prompt = promptById[promptId]
      if (prompt) {
        metadataById[promptId] = {
          status: prompt.status,
          completedAt: prompt.completedAt ?? null
        }
      }
    }

    return metadataById
  })
  const emptyFolderSettings = createEmptyPromptFolderSettings()
  const folderSettings = $derived.by<PromptFolderSettings>(() =>
    copyPromptFolderSettings(
      promptFolderDraft?.settings ?? promptFolder?.settings ?? emptyFolderSettings
    )
  )
  const folderSettingsTextByField = $derived.by<Record<PromptFolderSettingsField, string>>(
    () => folderSettings
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
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  const getRestoredPromptFolderScrollTop = (): number =>
    isCompletedMode ? 0 : (lookupPromptFolderScrollTop(promptFolderId) ?? 0)

  let initialPromptFolderScrollTopPx = $state(getRestoredPromptFolderScrollTop())
  let initialPromptFolderCenterRowId = $state<string | null>(null)
  let latestCenteredPromptTreeRow = $state<ActivePromptTreeRow | null>(null)
  let scrollTopPx = $state(getRestoredPromptFolderScrollTop())
  const TOP_SCROLL_EPSILON_PX = 1

  let promptFocusRequest = $state<PromptFocusRequest | null>(null)
  let promptFocusRequestId = $state(0)
  let latestHandledSelectionVersion = $state(0)
  let settingsSectionExpandedStates = $state<Record<string, boolean>>({})
  let promptsSectionExpandedStates = $state<Record<string, boolean>>({})

  const visiblePromptIds = $derived.by(() => {
    if (errorMessage) {
      return []
    }

    const loadedIds: string[] = []
    for (const promptId of screenPromptIds) {
      if (!promptDraftById[promptId]) {
        continue
      }

      const prompt = promptById[promptId]
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
    return visiblePromptIds.length === screenPromptIds.length
  })

  const findItems = $derived.by((): PromptFolderFindItem[] => {
    const nextItems: PromptFolderFindItem[] = []
    if (!errorMessage && !isCompletedMode) {
      PROMPT_FOLDER_SETTINGS_FIELDS.forEach((field) => {
        nextItems.push({
          entityId: promptFolderSettingsFindEntityId(promptFolderId, field),
          rowId: PROMPT_FOLDER_SETTINGS_ROW_ID,
          sections: [
            {
              key: PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS[field],
              text: folderSettingsTextByField[field]
            }
          ]
        })
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
      promptNavigation.selectionSource === 'prompt-create' ||
      promptNavigation.selectionSource === 'prompt-divider-create' ||
      promptNavigation.selectionSource === 'prompt-move' ||
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
    if (
      promptNavigation.selectionSource === 'prompt-create' ||
      promptNavigation.selectionSource === 'prompt-divider-create'
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

  const promptFolderSectionStateKey = $derived(
    `${workspaceId ?? 'no-workspace'}:${promptFolderId}:${screenMode}`
  )

  const lookupPersistedSettingsSectionExpandedState = (): boolean => {
    if (isCompletedMode) {
      return false
    }

    if (!workspaceId) {
      return false
    }

    return (
      lookupWorkspacePersistedPromptFolderSettingsSectionExpandedState(
        workspaceId,
        promptFolderId
      ) ?? false
    )
  }

  const lookupPersistedPromptsSectionExpandedState = (): boolean => {
    if (isCompletedMode) {
      return true
    }

    if (!workspaceId) {
      return true
    }

    return (
      lookupWorkspacePersistedPromptFolderPromptsSectionExpandedState(
        workspaceId,
        promptFolderId
      ) ?? true
    )
  }

  const isPromptsSectionExpanded = $derived(
    promptsSectionExpandedStates[promptFolderSectionStateKey] ??
      lookupPersistedPromptsSectionExpandedState()
  )

  const isSettingsSectionExpanded = $derived(
    settingsSectionExpandedStates[promptFolderSectionStateKey] ??
      lookupPersistedSettingsSectionExpandedState()
  )

  const setSettingsSectionExpanded = (isExpanded: boolean) => {
    if (isSettingsSectionExpanded === isExpanded) {
      return
    }

    settingsSectionExpandedStates = {
      ...settingsSectionExpandedStates,
      [promptFolderSectionStateKey]: isExpanded
    }

    if (!workspaceId || isCompletedMode) {
      return
    }

    setPromptFolderSettingsSectionExpandedStateWithAutosave(
      workspaceId,
      promptFolderId,
      isExpanded
    )
  }

  const toggleSettingsSectionExpanded = () => {
    setSettingsSectionExpanded(!isSettingsSectionExpanded)
  }

  const setPromptsSectionExpanded = (isExpanded: boolean) => {
    if (isPromptsSectionExpanded === isExpanded) {
      return
    }

    promptsSectionExpandedStates = {
      ...promptsSectionExpandedStates,
      [promptFolderSectionStateKey]: isExpanded
    }

    if (!workspaceId || isCompletedMode) {
      return
    }

    setPromptFolderPromptsSectionExpandedStateWithAutosave(
      workspaceId,
      promptFolderId,
      isExpanded
    )
  }

  const togglePromptsSectionExpanded = () => {
    setPromptsSectionExpanded(!isPromptsSectionExpanded)
  }

  const expandSectionForRow = (row: ActivePromptTreeRow): void => {
    if (isCompletedMode) {
      setPromptsSectionExpanded(true)
      return
    }

    if (row.kind === 'folder-settings') {
      setSettingsSectionExpanded(true)
    }

    if (row.kind === 'prompt') {
      setPromptsSectionExpanded(true)
    }
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
    if (isCompletedMode) {
      return
    }

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

  const requestPromptFocus = (promptId: string): void => {
    promptFocusRequestId += 1
    promptFocusRequest = { promptId, requestId: promptFocusRequestId }
  }

  const selectCreatedPrompt = (destinationPromptFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      folderId: destinationPromptFolderId,
      row,
      source: 'prompt-divider-create',
      forceVersionBump: true
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeEntryIdWithAutosave(
        workspaceId,
        destinationPromptFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onPromptFolderSelect(destinationPromptFolderId)
  }

  const selectMovedPrompt = (destinationPromptFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      folderId: destinationPromptFolderId,
      row,
      source: 'prompt-move',
      forceVersionBump: true
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeEntryIdWithAutosave(
        workspaceId,
        destinationPromptFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onPromptFolderSelect(destinationPromptFolderId)
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
    if (nextRow.kind === 'prompt' && !isPromptsSectionExpanded) {
      setPromptsSectionExpanded(true)
      return false
    }

    expandSectionForRow(nextRow)
    scrollToAndTrackRowCentered(toPromptFolderRowId(nextRow))
    return true
  }

  const selectPromptTreeRowMinimally = (nextRow: ActivePromptTreeRow): boolean => {
    if (!scrollToWithinWindowBand) return false
    if (nextRow.kind === 'prompt' && !isPromptsSectionExpanded) {
      setPromptsSectionExpanded(true)
      return false
    }

    expandSectionForRow(nextRow)
    scrollToWithinWindowBand(toPromptFolderRowId(nextRow), 0, 'minimal')
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

    for (const promptId of [
      ...getPromptIdsForFolder(cachedPromptFolder),
      ...cachedPromptFolder.completedPromptIds
    ]) {
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
    const shouldApplyInitialCenterRow =
      !isCompletedMode && Boolean(explicitSelectionRow || persistedSelectionRow)
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
    latestCenteredPromptTreeRow = isCompletedMode ? null : initialSelectionRow

    if (
      promptNavigation.selectionSource === 'prompt-create' &&
      initialSelectionRow.kind === 'prompt'
    ) {
      requestPromptFocus(initialSelectionRow.promptId)
    }

    if (isCompletedMode) {
      latestHandledSelectionVersion = promptNavigation.selectionVersion
    } else if (explicitSelectionRow && currentNavigationRow) {
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

    if (source === 'prompt-divider-create') {
      if (!selectPromptTreeRowMinimally(target)) return
      if (target.kind === 'prompt') {
        requestPromptFocus(target.promptId)
      }
      latestHandledSelectionVersion = promptNavigation.selectionVersion
      return
    }

    if (!selectPromptTreeRowAndCenter(target)) return
    if (source === 'prompt-create' && target.kind === 'prompt') {
      requestPromptFocus(target.promptId)
    }
    latestHandledSelectionVersion = promptNavigation.selectionVersion
  })

  // Side effect: normalize stale prompt selections to folder settings once rows are loaded.
  $effect(() => {
    if (!isVirtualContentReady) return
    if (isCompletedMode) return
    if (!activePromptTreeRow || activePromptTreeRow.kind !== 'prompt') return
    if (visiblePromptIds.includes(activePromptTreeRow.promptId)) return

    setCurrentFolderSelection({ kind: 'folder-settings' }, 'restore', { forceVersionBump: true })
  })

  const movePromptFromCurrentFolder = async (
    promptId: string,
    destinationPromptFolderId: string,
    orderAfterPromptId: string | null
  ): Promise<boolean> => {
    const currentPromptFolder = promptFolder
    if (!currentPromptFolder) {
      return false
    }

    const destinationPromptFolder = promptFolderCollection.get(destinationPromptFolderId)
    if (!destinationPromptFolder) {
      return false
    }

    const nextMove = resolvePromptHandleDropMove(
      currentPromptFolder.id,
      getPromptIdsForFolder(currentPromptFolder),
      promptId,
      orderAfterPromptId === null
        ? { kind: 'folder', folderId: destinationPromptFolderId }
        : {
            kind: 'prompt',
            folderId: destinationPromptFolderId,
            promptId: orderAfterPromptId,
            edge: 'bottom'
          },
      getPromptIdsForFolder(destinationPromptFolder)
    )
    if (!nextMove) {
      return false
    }

    return await runIpcBestEffort(
      async () => {
        await movePrompt(
          currentPromptFolder.id,
          destinationPromptFolderId,
          promptId,
          orderAfterPromptId
        )
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

    const creation = createBlankPromptInFolder(currentPromptFolder.id, previousPromptId)
    selectCreatedPrompt(currentPromptFolder.id, creation.promptId)
    await runIpcBestEffort(() => creation.persistence)

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

  const handleSetPromptStatus = (nextPromptId: string, status: PromptStatus) => {
    const currentPromptFolderId = promptFolder?.id
    if (!currentPromptFolderId) {
      return
    }

    void runIpcBestEffort(async () => {
      await setPromptStatus(currentPromptFolderId, nextPromptId, status)
    })
  }

  const handleMovePromptUp = async (nextPromptId: string): Promise<boolean> => {
    const currentPromptIds = promptFolder ? getPromptIdsForFolder(promptFolder) : []
    const currentIndex = currentPromptIds.indexOf(nextPromptId)
    if (currentIndex <= 0) {
      return false
    }

    const previousPromptId = currentIndex <= 1 ? null : currentPromptIds[currentIndex - 2]
    return await movePromptFromCurrentFolder(nextPromptId, promptFolderId, previousPromptId)
  }

  const handleMovePromptDown = async (nextPromptId: string): Promise<boolean> => {
    const currentPromptIds = promptFolder ? getPromptIdsForFolder(promptFolder) : []
    const currentIndex = currentPromptIds.indexOf(nextPromptId)
    if (currentIndex === -1 || currentIndex >= currentPromptIds.length - 1) {
      return false
    }

    const previousPromptId = currentPromptIds[currentIndex + 1]
    return await movePromptFromCurrentFolder(nextPromptId, promptFolderId, previousPromptId)
  }

  const handlePromptTreeDrop = (
    draggedPromptId: string,
    dropPayload: PromptHandleDropPayload | null
  ) => {
    const currentPromptFolder = promptFolder
    if (!currentPromptFolder) {
      return
    }

    const nextMove = resolvePromptHandleDropMove(
      currentPromptFolder.id,
      getPromptIdsForFolder(currentPromptFolder),
      draggedPromptId,
      dropPayload,
      dropPayload?.kind === 'prompt'
        ? (((): string[] | null => {
            const targetFolder = promptFolderQuery.data.find(
              (folder) => folder?.id === dropPayload.folderId
            )
            return targetFolder ? getPromptIdsForFolder(targetFolder) : null
          })())
        : getPromptIdsForFolder(currentPromptFolder)
    )
    if (!nextMove) {
      return
    }

    void movePromptFromCurrentFolder(
      draggedPromptId,
      nextMove.destinationPromptFolderId,
      nextMove.orderAfterPromptId
    )

    if (nextMove.sourcePromptFolderId !== nextMove.destinationPromptFolderId) {
      selectMovedPrompt(nextMove.destinationPromptFolderId, draggedPromptId)
    }
  }

  const handleSettingsFieldChange = (
    field: PromptFolderSettingsDraftField,
    text: string,
    measurement: TextMeasurement
  ) => {
    setPromptFolderDraftSettingsField(promptFolderId, field, text, measurement)
  }

  const folderSettingsHeightPx = $derived.by(() => {
    if (isCompletedMode) {
      return 0
    }

    if (!isSettingsSectionExpanded) {
      return getPromptFolderEditorCollapsedCardRowHeightPx()
    }

    const estimatedSectionHeights = Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        estimatePromptFolderSettingsFieldRowHeight(
          folderSettingsTextByField[field],
          promptEditorSizingConfig.fontSize
        )
      ])
    ) as Record<PromptFolderSettingsField, number>

    if (!viewportMetrics) {
      return getPromptFolderEditorCardRowHeightPx(estimatedSectionHeights)
    }

    const metrics = viewportMetrics
    const sectionHeights = Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        lookupPromptFolderSettingsRowMeasuredHeight(
          promptFolderId,
          field,
          metrics.widthPx,
          metrics.devicePixelRatio
        ) ?? estimatedSectionHeights[field]
      ])
    ) as Record<PromptFolderSettingsField, number>

    return getPromptFolderEditorCardRowHeightPx(sectionHeights)
  })

  const activeHeaderRowId = $derived(
    isCompletedMode || scrollTopPx >= folderSettingsHeightPx
      ? 'prompt-header'
      : PROMPT_FOLDER_SETTINGS_ROW_ID
  )
  const activeHeaderSection = $derived(
    isCompletedMode
      ? 'Completed Prompts'
      : activeHeaderRowId === 'prompt-header'
        ? 'Prompts'
        : 'Folder Settings'
  )

  const resolveHeaderSelectionRow = (
    rowId: 'folder-settings' | 'prompt-header'
  ): ActivePromptTreeRow | null => {
    if (rowId === 'folder-settings') {
      if (isCompletedMode) {
        return null
      }

      return { kind: 'folder-settings' }
    }

    const firstPromptId = visiblePromptIds[0]
    if (firstPromptId) {
      return { kind: 'prompt', promptId: firstPromptId }
    }

    return isCompletedMode ? null : { kind: 'folder-settings' }
  }

  const handleHeaderSegmentClick = (rowId: 'folder-settings' | 'prompt-header') => {
    if (!scrollToWithinWindowBand) return
    const targetRow = resolveHeaderSelectionRow(rowId)
    if (targetRow) {
      expandSectionForRow(targetRow)
      setCurrentFolderSelection(targetRow, 'header', {
        forceVersionBump: true
      })
    }
    // Header navigation should land directly on the target section.
    scrollToWithinWindowBand(targetRow ? toPromptFolderRowId(targetRow) : rowId, 0, 'minimal', 0)
  }

  const handleHeaderFolderClick = () => {
    if (!scrollApi) return
    if (!isCompletedMode) {
      setSettingsSectionExpanded(true)
      setCurrentFolderSelection({ kind: 'folder-settings' }, 'header', {
        forceVersionBump: true
      })
    }
    scrollApi.scrollTo(0)
  }

  const handleFindMatchReveal = (match: PromptFolderFindMatch) => {
    const targetRow: ActivePromptTreeRow | null = isPromptFolderSettingsFindEntityId(
      match.entityId,
      promptFolderId
    )
      ? isCompletedMode
        ? null
        : { kind: 'folder-settings' }
      : { kind: 'prompt', promptId: match.entityId }
    if (!targetRow) return
    expandSectionForRow(targetRow)
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
    get promptEditorSizingConfig(): PromptEditorSizingConfig {
      return promptEditorSizingConfig
    },
    get folderSettings(): PromptFolderSettings {
      return folderSettings
    },
  get folderDisplayName(): string {
      return folderDisplayName
    },
    get promptFolder(): PromptFolder | null {
      return promptFolder
    },
    get promptFolders(): PromptFolder[] {
      return promptFolderQuery.data.filter(
        (currentPromptFolder): currentPromptFolder is PromptFolder =>
          currentPromptFolder !== undefined
      )
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
    get promptMetadataByPromptId(): Record<string, PromptMetadata> {
      return promptMetadataByPromptId
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
    get isSettingsSectionExpanded(): boolean {
      return isSettingsSectionExpanded
    },
    get isPromptsSectionExpanded(): boolean {
      return isPromptsSectionExpanded
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
    get activeHeaderSection(): 'Folder Settings' | 'Prompts' | 'Completed Prompts' {
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
    handlePromptTreeDrop,
    handleSettingsFieldChange,
    setScrollToWithinWindowBand,
    setScrollToAndTrackRowCentered,
    setScrollApi,
    setViewportMetrics,
    handleVirtualScrollTopChange,
    handleInitialPromptFolderCenterRowApplied,
    handleVirtualCenterRowChange,
    handleVirtualUserScroll
  }
}

export type PromptFolderScreenController = ReturnType<typeof createPromptFolderScreenController>
