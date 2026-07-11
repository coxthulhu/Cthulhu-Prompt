import { useLiveQuery } from '@tanstack/svelte-db'
import { SvelteSet } from 'svelte/reactivity'
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
  promptFolderEditorRowId,
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
import {
  buildPromptFolderScreenRows,
  type PromptFolderDividerTarget,
  type PromptFolderScreenRow
} from './promptFolderScreenRows'

export type ActivePromptTreeRow =
  | { kind: 'folder-settings'; rowOwnerFolderId: string }
  | { kind: 'prompt'; rowOwnerFolderId: string; promptId: string }
export type PromptFocusRequest = { promptId: string; requestId: number }

type PromptMetadata = {
  status: PromptStatus
  completedAt: string | null
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
  const promptFolderDraftQuery = useLiveQuery(promptFolderDraftCollection) as {
    data: PromptFolderDraftRecord[]
  }

  const screenRootFolder = $derived.by(() => {
    for (const candidate of promptFolderQuery.data) {
      if (candidate?.id === screenRootFolderId) {
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
  const screenRootFolderDraft = $derived(promptFolderDraftById[screenRootFolderId] ?? null)
  const getPromptIdsForFolder = (folder: PromptFolder): string[] =>
    folder.entryIds.filter((entryId) => promptById[entryId])
  const rootPromptIds = $derived(
    screenRootFolder ? getPromptIdsForFolder(screenRootFolder) : []
  )
  const completedPromptIds = $derived(screenRootFolder?.completedPromptIds ?? [])
  const completedPromptCount = $derived(completedPromptIds.length)
  const orderedCompletedPromptIds = $derived.by(() =>
    [...completedPromptIds].sort((leftPromptId, rightPromptId) => {
      const leftCompletedAt = promptById[leftPromptId]?.completedAt ?? ''
      const rightCompletedAt = promptById[rightPromptId]?.completedAt ?? ''
      return rightCompletedAt.localeCompare(leftCompletedAt)
    })
  )
  const emptyFolderSettings = createEmptyPromptFolderSettings()
  const folderSettingsByFolderId = $derived.by<Record<string, PromptFolderSettings>>(() => {
    const settingsByFolderId: Record<string, PromptFolderSettings> = {}
    for (const folder of promptFolderQuery.data) {
      if (!folder) continue
      settingsByFolderId[folder.id] = copyPromptFolderSettings(
        promptFolderDraftById[folder.id]?.settings ?? folder.settings
      )
    }
    return settingsByFolderId
  })
  const folderSettings = $derived(
    folderSettingsByFolderId[screenRootFolderId] ?? emptyFolderSettings
  )
  const folderSettingsTextByField = $derived.by<Record<PromptFolderSettingsField, string>>(
    () => folderSettings
  )
  const folderDisplayName = $derived(screenRootFolder?.displayName ?? 'Prompt Folder')

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
    isCompletedMode ? 0 : (lookupPromptFolderScrollTop(screenRootFolderId) ?? 0)

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
      lookupWorkspacePersistedPromptFolderPromptsSectionExpandedState(
        workspaceId,
        ownerFolderId
      ) ?? true
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
    return expandedByFolderId
  })
  const settingsSectionExpandedByFolderId = $derived.by<Record<string, boolean>>(() => {
    const expandedByFolderId: Record<string, boolean> = {}
    for (const folder of promptFolderQuery.data) {
      if (!folder) continue
      expandedByFolderId[folder.id] = getIsSettingsSectionExpanded(folder.id)
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
      descendantFolders: promptFolderQuery.data.filter(
        (candidate): candidate is PromptFolder =>
          candidate !== undefined && candidate.id !== screenRootFolder.id
      ),
      promptIds: promptQuery.data.flatMap((prompt) => (prompt ? [prompt.id] : [])),
      isFolderExpanded: (folderId) =>
        promptsSectionExpandedByFolderId[folderId] ?? true
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
      descendantFolders: promptFolderQuery.data.filter(
        (candidate): candidate is PromptFolder =>
          candidate !== undefined && candidate.id !== screenRootFolder.id
      ),
      promptIds: promptQuery.data.flatMap((prompt) => (prompt ? [prompt.id] : [])),
      isFolderExpanded: () => true
    }).flatMap((row) => (row.kind === 'prompt-editor' ? [row.promptId] : []))
  })
  const screenPromptIds = $derived(
    isCompletedMode ? orderedCompletedPromptIds : rootPromptIds
  )
  const renderedPromptIds = $derived(
    isCompletedMode ? orderedCompletedPromptIds : activeScreenPromptIds
  )
  const promptMetadataByPromptId = $derived.by(() => {
    const metadataById: Record<string, PromptMetadata> = {}
    for (const promptId of renderedPromptIds) {
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

  const navigablePromptIds = $derived(
    allActiveScreenPromptIds.filter((promptId) => {
      const prompt = promptById[promptId]
      return Boolean(promptDraftById[promptId] && prompt && isPromptFull(prompt))
    })
  )

  const isVirtualContentReady = $derived.by(() => {
    if (errorMessage) return true
    if (isLoading) return false
    if (!screenRootFolder) return false
    if (!screenRootFolderDraft?.hasLoadedInitialData) return false
    return renderedPromptIds.every((promptId) => {
      const prompt = promptById[promptId]
      return Boolean(promptDraftById[promptId] && prompt && isPromptFull(prompt))
    })
  })

  const findItems = $derived.by((): PromptFolderFindItem[] => {
    const nextItems: PromptFolderFindItem[] = []
    if (!errorMessage && !isCompletedMode) {
      PROMPT_FOLDER_SETTINGS_FIELDS.forEach((field) => {
        nextItems.push({
          entityId: promptFolderSettingsFindEntityId(screenRootFolderId, field),
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
    if (promptNavigation.screenRootFolderId !== screenRootFolderId) {
      return false
    }

    return (
      promptNavigation.selectionSource === 'tree-click' ||
      promptNavigation.selectionSource === 'folder-open' ||
      promptNavigation.selectionSource === 'prompt-create' ||
      promptNavigation.selectionSource === 'prompt-divider-create' ||
      promptNavigation.selectionSource === 'subfolder-create' ||
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
      return { kind: 'folder-settings', rowOwnerFolderId: screenRootFolderId }
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

  const toActivePromptTreeRow = (
    rowOwnerFolderId: string,
    row: PromptNavigationRow
  ): ActivePromptTreeRow => {
    return row === 'folder-settings'
      ? { kind: 'folder-settings', rowOwnerFolderId }
      : { kind: 'prompt', rowOwnerFolderId, promptId: row.slice('prompt:'.length) }
  }

  const toPromptFolderRowId = (row: ActivePromptTreeRow): string => {
    return row.kind === 'folder-settings'
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

    setPromptFolderSettingsSectionExpandedStateWithAutosave(
      workspaceId,
      ownerFolderId,
      isExpanded
    )
  }

  const toggleSettingsSectionExpanded = (ownerFolderId: string) => {
    setSettingsSectionExpanded(
      ownerFolderId,
      !getIsSettingsSectionExpanded(ownerFolderId)
    )
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

    setPromptFolderPromptsSectionExpandedStateWithAutosave(
      workspaceId,
      ownerFolderId,
      isExpanded
    )
  }

  const togglePromptsSectionExpanded = (ownerFolderId: string) => {
    setPromptsSectionExpanded(ownerFolderId, !getIsPromptsSectionExpanded(ownerFolderId))
  }

  const findFolderPath = (
    currentFolderId: string,
    targetFolderId: string,
    visitedFolderIds = new SvelteSet<string>()
  ): string[] | null => {
    if (visitedFolderIds.has(currentFolderId)) return null
    visitedFolderIds.add(currentFolderId)
    if (currentFolderId === targetFolderId) return [currentFolderId]

    const currentFolder = promptFolderQuery.data.find((folder) => folder?.id === currentFolderId)
    if (!currentFolder) return null
    for (const entryId of currentFolder.entryIds) {
      const childPath = findFolderPath(entryId, targetFolderId, visitedFolderIds)
      if (childPath) return [currentFolderId, ...childPath]
    }

    return null
  }

  const expandSectionForRow = (
    row: ActivePromptTreeRow,
    expandFolderSettings = true
  ): boolean => {
    let changed = false
    if (isCompletedMode) {
      if (!getIsPromptsSectionExpanded(screenRootFolderId)) {
        setPromptsSectionExpanded(screenRootFolderId, true)
        changed = true
      }
      return changed
    }

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

    return toActivePromptTreeRow(
      promptNavigation.rowOwnerFolderId,
      promptNavigation.selectedRow
    )
  })

  const activePromptTreeRow = $derived(selectedNavigationTarget)

  const setCurrentFolderSelection = (
    nextRow: ActivePromptTreeRow | null,
    source: PromptNavigationSource,
    options: { forceVersionBump?: boolean } = {}
  ) => {
    if (!nextRow) {
      return
    }

    promptNavigation.select({
      screenRootFolderId,
      rowOwnerFolderId: nextRow.rowOwnerFolderId,
      row: toPromptNavigationRow(nextRow),
      source,
      forceVersionBump: options.forceVersionBump ?? false
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

  const requestPromptFocus = (promptId: string): void => {
    promptFocusRequestId += 1
    promptFocusRequest = { promptId, requestId: promptFocusRequestId }
  }

  const selectCreatedPrompt = (rowOwnerFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      screenRootFolderId,
      rowOwnerFolderId,
      row,
      source: 'prompt-divider-create',
      forceVersionBump: true
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

  const handleCreatedSubfolder = (promptFolderId: string): void => {
    promptNavigation.select({
      screenRootFolderId,
      rowOwnerFolderId: promptFolderId,
      row: 'folder-settings',
      source: 'subfolder-create',
      forceVersionBump: true
    })
  }

  const selectMovedPrompt = (destinationPromptFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      screenRootFolderId: destinationPromptFolderId,
      rowOwnerFolderId: destinationPromptFolderId,
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

    onScreenRootFolderSelect(destinationPromptFolderId)
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

  const selectPromptTreeRowAndCenter = (
    nextRow: ActivePromptTreeRow,
    expandFolderSettings = true
  ): boolean => {
    if (!scrollToAndTrackRowCentered) return false
    if (expandSectionForRow(nextRow, expandFolderSettings)) return false
    scrollToAndTrackRowCentered(toPromptFolderRowId(nextRow))
    return true
  }

  const selectPromptTreeRowMinimally = (nextRow: ActivePromptTreeRow): boolean => {
    if (!scrollToWithinWindowBand) return false
    if (expandSectionForRow(nextRow)) return false
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
        kind: 'folder-settings',
        rowOwnerFolderId: screenRootFolderId
      }
    const shouldApplyInitialCenterRow =
      !isCompletedMode && Boolean(explicitSelectionTarget || persistedSelectionTarget)
    const restoredScrollTop = explicitSelectionTarget ? 0 : getRestoredPromptFolderScrollTop()
    const restoreSelectionSource: PromptNavigationSource =
      !explicitSelectionTarget && !persistedSelectionTarget && restoredScrollTop <= 0
        ? 'restore-hold'
        : 'restore'

    if (explicitSelectionTarget) {
      expandSectionForRow(
        explicitSelectionTarget,
        promptNavigation.selectionSource !== 'folder-open'
      )
    }

    isLoading = !canUseCachedData
    shouldShowLoadingOverlay = !canUseCachedData
    pendingInitialCenterRowApplyCount = shouldApplyInitialCenterRow ? 1 : 0
    isCreatingPrompt = false
    errorMessage = null
    initialPromptFolderCenterRowId = shouldApplyInitialCenterRow
      ? toPromptFolderRowId(initialSelectionTarget)
      : null
    initialPromptFolderScrollTopPx = restoredScrollTop
    scrollTopPx = restoredScrollTop
    latestCenteredPromptTreeRow = isCompletedMode ? null : initialSelectionTarget

    if (
      promptNavigation.selectionSource === 'prompt-create' &&
      initialSelectionTarget.kind === 'prompt'
    ) {
      requestPromptFocus(initialSelectionTarget.promptId)
    }

    if (isCompletedMode) {
      latestHandledSelectionVersion = promptNavigation.selectionVersion
    } else if (explicitSelectionTarget && currentNavigationTarget) {
      latestHandledSelectionVersion = promptNavigation.selectionVersion
    } else {
      if (!currentNavigationTarget) {
        setCurrentFolderSelection(initialSelectionTarget, restoreSelectionSource)
      }
      latestHandledSelectionVersion = shouldApplyInitialCenterRow
        ? promptNavigation.selectionVersion
        : 0
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
        clearInitialPersistedScrollWait()
      }
    })()
  })

  // Side effect: center the selected owner row within this root folder screen.
  $effect(() => {
    const target = selectedNavigationTarget
    if (!target) return
    if (target.kind === 'prompt' && !navigablePromptIds.includes(target.promptId)) {
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

    if (
      !selectPromptTreeRowAndCenter(
        target,
        source !== 'folder-open' && source !== 'subfolder-create'
      )
    ) {
      return
    }
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
    if (navigablePromptIds.includes(activePromptTreeRow.promptId)) return

    setCurrentFolderSelection(
      { kind: 'folder-settings', rowOwnerFolderId: activePromptTreeRow.rowOwnerFolderId },
      'restore',
      { forceVersionBump: true }
    )
  })

  const movePromptFromCurrentFolder = async (
    promptId: string,
    destinationPromptFolderId: string,
    orderAfterPromptId: string | null
  ): Promise<boolean> => {
    const currentPromptFolder = screenRootFolder
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

  const handleAddPrompt = async (target: PromptFolderDividerTarget) => {
    const rowOwnerFolder = promptFolderCollection.get(target.ownerFolderId)
    if (!rowOwnerFolder || isCreatingPrompt) {
      return
    }

    isCreatingPrompt = true

    const creation = createBlankPromptInFolder(
      rowOwnerFolder.id,
      target.previousEntryId
    )
    selectCreatedPrompt(rowOwnerFolder.id, creation.promptId)
    await runIpcBestEffort(() => creation.persistence)

    isCreatingPrompt = false
  }

  const handleDeletePrompt = (nextPromptId: string) => {
    const currentPromptFolderId = screenRootFolder?.id
    if (!currentPromptFolderId) {
      return
    }

    void runIpcBestEffort(async () => {
      await deletePrompt(currentPromptFolderId, nextPromptId)
    })
  }

  const handleSetPromptStatus = (nextPromptId: string, status: PromptStatus) => {
    const currentPromptFolderId = screenRootFolder?.id
    if (!currentPromptFolderId) {
      return
    }

    void runIpcBestEffort(async () => {
      await setPromptStatus(currentPromptFolderId, nextPromptId, status)
    })
  }

  const handleMovePromptUp = async (nextPromptId: string): Promise<boolean> => {
    const currentPromptIds = screenRootFolder ? getPromptIdsForFolder(screenRootFolder) : []
    const currentIndex = currentPromptIds.indexOf(nextPromptId)
    if (currentIndex <= 0) {
      return false
    }

    const previousPromptId = currentIndex <= 1 ? null : currentPromptIds[currentIndex - 2]
    return await movePromptFromCurrentFolder(nextPromptId, screenRootFolderId, previousPromptId)
  }

  const handleMovePromptDown = async (nextPromptId: string): Promise<boolean> => {
    const currentPromptIds = screenRootFolder ? getPromptIdsForFolder(screenRootFolder) : []
    const currentIndex = currentPromptIds.indexOf(nextPromptId)
    if (currentIndex === -1 || currentIndex >= currentPromptIds.length - 1) {
      return false
    }

    const previousPromptId = currentPromptIds[currentIndex + 1]
    return await movePromptFromCurrentFolder(nextPromptId, screenRootFolderId, previousPromptId)
  }

  const handlePromptTreeDrop = (
    draggedPromptId: string,
    dropPayload: PromptHandleDropPayload | null
  ) => {
    const currentPromptFolder = screenRootFolder
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
    ownerFolderId: string,
    field: PromptFolderSettingsDraftField,
    text: string,
    measurement: TextMeasurement
  ) => {
    setPromptFolderDraftSettingsField(ownerFolderId, field, text, measurement)
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
          screenRootFolderId,
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

      return { kind: 'folder-settings', rowOwnerFolderId: screenRootFolderId }
    }

    const firstPromptId = visiblePromptIds[0]
    if (firstPromptId) {
      const promptRow = activePromptFolderScreenRows.find(
        (row) => row.kind === 'prompt-editor' && row.promptId === firstPromptId
      )
      return {
        kind: 'prompt',
        rowOwnerFolderId: promptRow?.ownerFolderId ?? screenRootFolderId,
        promptId: firstPromptId
      }
    }

    return isCompletedMode
      ? null
      : { kind: 'folder-settings', rowOwnerFolderId: screenRootFolderId }
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
      setSettingsSectionExpanded(screenRootFolderId, true)
      setCurrentFolderSelection(
        { kind: 'folder-settings', rowOwnerFolderId: screenRootFolderId },
        'header',
        {
          forceVersionBump: true
        }
      )
    }
    scrollApi.scrollTo(0)
  }

  const handleFindMatchReveal = (match: PromptFolderFindMatch) => {
    const targetRow: ActivePromptTreeRow | null = isPromptFolderSettingsFindEntityId(
      match.entityId,
      screenRootFolderId
    )
      ? isCompletedMode
        ? null
        : { kind: 'folder-settings', rowOwnerFolderId: screenRootFolderId }
      : {
          kind: 'prompt',
          rowOwnerFolderId:
            activePromptFolderScreenRows.find(
              (row) => row.kind === 'prompt-editor' && row.promptId === match.entityId
            )?.ownerFolderId ?? screenRootFolderId,
          promptId: match.entityId
        }
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
    get activePromptFolderScreenRows(): PromptFolderScreenRow[] {
      return activePromptFolderScreenRows
    },
    get visiblePromptIds(): string[] {
      return visiblePromptIds
    },
    get completedPromptCount(): number {
      return completedPromptCount
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
    get settingsSectionExpandedByFolderId(): Record<string, boolean> {
      return settingsSectionExpandedByFolderId
    },
    get promptsSectionExpandedByFolderId(): Record<string, boolean> {
      return promptsSectionExpandedByFolderId
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
    handleCreatedSubfolder,
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
