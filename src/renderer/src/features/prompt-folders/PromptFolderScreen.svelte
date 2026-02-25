<script lang="ts">
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
    lookupPromptEditorMeasuredHeight,
    lookupPromptFolderDescriptionMeasuredHeight,
    lookupPromptFolderScrollTop,
    recordPromptFolderScrollTop
  } from '@renderer/data/UiState/PromptMeasurementCache.svelte.ts'
  import { setPromptFolderDraftDescription } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
  import { setPromptOutlinerWidthWithAutosave } from '@renderer/data/UiState/UserPersistenceAutosave.svelte.ts'
  import PromptEditorRow from '../prompt-editor/PromptEditorRow.svelte'
  import { estimatePromptEditorHeight } from '../prompt-editor/promptEditorSizing'
  import PromptDivider from '../prompt-editor/PromptDivider.svelte'
  import BottomSpacer, { getBottomSpacerHeightPx } from '../prompt-editor/BottomSpacer.svelte'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import ResizableSidebar from '../sidebar/ResizableSidebar.svelte'
  import LoadingOverlay from '@renderer/common/ui/loading/LoadingOverlay.svelte'
  import { createLoadingOverlayState } from '@renderer/common/ui/loading/loadingOverlayState.svelte.ts'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type ScrollToAndTrackRowCentered,
    type VirtualWindowItem,
    type VirtualWindowScrollApi,
    type VirtualWindowViewportMetrics,
    type VirtualWindowRowComponentProps
  } from '../virtualizer/virtualWindowTypes'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import {
    PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY,
    PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
    PROMPT_FOLDER_FIND_TITLE_SECTION_KEY
  } from './find/promptFolderFindSectionKeys'
  import type { PromptFolderFindItem } from './find/promptFolderFindTypes'
  import { promptEditorRowId, promptFolderSettingsFindEntityId } from './promptFolderRowIds'
  import PromptFolderSettingsRow from './PromptFolderSettingsRow.svelte'
  import {
    estimatePromptFolderSettingsHeight,
    PROMPT_HEADER_ROW_HEIGHT_PX
  } from './promptFolderSettingsSizing'
  import PromptFolderOutliner from './PromptFolderOutliner.svelte'

  let { promptFolderId } = $props<{ promptFolderId: string }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)

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
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  let activeOutlinerRow = $state<ActiveOutlinerRow | null>(null)
  let latestCenteredOutlinerRow = $state<ActiveOutlinerRow | null>(null)
  // Manual selection keeps the outliner highlight on the clicked row until the user scrolls.
  let outlinerManualSelectionActive = $state(false)
  let outlinerAutoScrollRequestId = $state(0)
  const getUserPersistenceDraft = () => userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)!
  const promptOutlinerDefaultWidthPx = getUserPersistenceDraft().promptOutlinerWidthPx
  let sidebarWidthPx = $state(promptOutlinerDefaultWidthPx)
  let scrollRestoreVersion = $state(0)
  let lastScrollRestoreVersion = 0
  let hasRestoredScrollTopForCurrentFolder = $state(false)
  let scrollTopPx = $state(0)

  type PromptFocusRequest = { promptId: string; requestId: number }
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

  const clearOutlinerManualSelection = () => {
    outlinerManualSelectionActive = false
  }

  const scrollToWithinWindowBandWithManualClear: ScrollToWithinWindowBand = (
    rowId,
    offsetPx,
    scrollType
  ) => {
    clearOutlinerManualSelection()
    scrollToWithinWindowBand?.(rowId, offsetPx, scrollType)
  }

  const resetPromptFolderUiState = () => {
    activeOutlinerRow = { kind: 'folder-settings' }
    outlinerManualSelectionActive = true
    outlinerAutoScrollRequestId += 1
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
    hasRestoredScrollTopForCurrentFolder = false
    resetPromptFolderUiState()
    if (canUseCachedData) {
      scrollRestoreVersion += 1
    }

    void (async () => {
      try {
        await loadPromptFolderInitial(workspaceId, promptFolderId)
        if (requestId !== promptFolderLoadRequestId) return
        isLoading = false
        if (!canUseCachedData) {
          scrollRestoreVersion += 1
        }
      } catch (error) {
        if (requestId !== promptFolderLoadRequestId) return
        errorMessage = error instanceof Error ? error.message : String(error)
        isLoading = false
      }
    })()
  })

  // Side effect: restore the virtual window scroll position after folder changes.
  $effect(() => {
    if (!scrollApi) return
    if (scrollRestoreVersion === lastScrollRestoreVersion) return
    if (!errorMessage && promptIds.length > 0 && visiblePromptIds.length === 0) return
    lastScrollRestoreVersion = scrollRestoreVersion
    scrollApi.scrollTo(lookupPromptFolderScrollTop(promptFolderId) ?? 0)
    hasRestoredScrollTopForCurrentFolder = true
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

  const lookupPromptFolderDescriptionMeasuredHeightForScreen = (
    widthPx: number,
    devicePixelRatio: number
  ): number | null => {
    return lookupPromptFolderDescriptionMeasuredHeight(promptFolderId, widthPx, devicePixelRatio)
  }

  type PromptFolderRow =
    | { kind: 'folder-settings' }
    | { kind: 'prompt-header'; promptCount: number }
    | { kind: 'placeholder' }
    | { kind: 'prompt-divider'; previousPromptId: string | null }
    | { kind: 'prompt-editor'; promptId: string }
    | { kind: 'bottom-spacer' }

  type PromptEditorRowProps = VirtualWindowRowComponentProps<
    Extract<PromptFolderRow, { kind: 'prompt-editor' }>
  >
  type ActiveOutlinerRow = { kind: 'folder-settings' } | { kind: 'prompt'; promptId: string }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    'folder-settings': {
      estimateHeight: () =>
        estimatePromptFolderSettingsHeight(descriptionText, promptFontSize, promptEditorMinLines),
      lookupMeasuredHeight: (_row, widthPx, devicePixelRatio) =>
        lookupPromptFolderDescriptionMeasuredHeightForScreen(widthPx, devicePixelRatio),
      hydrationPriorityEligible: true,
      needsOverlayRow: true,
      centerRowEligible: true,
      dehydrateOnWidthResize: true,
      snippet: folderSettingsRow
    },
    'prompt-header': {
      estimateHeight: () => PROMPT_HEADER_ROW_HEIGHT_PX,
      snippet: promptHeaderRow
    },
    placeholder: {
      estimateHeight: () => 120,
      snippet: placeholderRow
    },
    'prompt-divider': {
      // Match the xs button height so the divider row doesn't clip.
      estimateHeight: () => 28,
      snippet: dividerRow
    },
    'prompt-editor': {
      estimateHeight: (row, widthPx, heightPx) =>
        estimatePromptEditorHeight(
          promptDraftById[row.promptId]!.promptText,
          widthPx,
          heightPx,
          promptFontSize,
          promptEditorMinLines
        ),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        return lookupPromptEditorMeasuredHeight(row.promptId, widthPx, devicePixelRatio)
      },
      hydrationPriorityEligible: true,
      centerRowEligible: true,
      needsOverlayRow: true,
      dehydrateOnWidthResize: true,
      snippet: promptEditorRow
    },
    'bottom-spacer': {
      estimateHeight: (_row, _widthPx, heightPx) => getBottomSpacerHeightPx(heightPx),
      snippet: bottomSpacerRow
    }
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptFolderRow>[] => {
    const rows: VirtualWindowItem<PromptFolderRow>[] = [
      {
        id: 'folder-settings',
        row: {
          kind: 'folder-settings'
        }
      },
      {
        id: 'prompt-header',
        row: {
          kind: 'prompt-header',
          promptCount: visiblePromptIds.length
        }
      }
    ]

    if (visiblePromptIds.length === 0) {
      rows.push({
        id: 'divider-initial',
        row: { kind: 'prompt-divider', previousPromptId: null }
      })
      rows.push({
        id: 'placeholder-empty',
        row: { kind: 'placeholder' }
      })
    } else {
      rows.push({
        id: 'divider-initial',
        row: { kind: 'prompt-divider', previousPromptId: null }
      })

      visiblePromptIds.forEach((promptId) => {
        rows.push({ id: promptEditorRowId(promptId), row: { kind: 'prompt-editor', promptId } })
        rows.push({
          id: `${promptId}-divider`,
          row: { kind: 'prompt-divider', previousPromptId: promptId }
        })
      })
    }

    rows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return rows
  })
  const buildPromptFindItem = (
    virtualItem: VirtualWindowItem<PromptFolderRow>
  ): PromptFolderFindItem | null => {
    const { row, id: rowId } = virtualItem
    if (row.kind !== 'prompt-editor') return null
    const promptDraft = promptDraftById[row.promptId]
    if (!promptDraft) return null
    return {
      entityId: row.promptId,
      rowId,
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
    }
  }
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
    for (const virtualItem of virtualItems) {
      const findItem = buildPromptFindItem(virtualItem)
      if (!findItem) continue
      nextItems.push(findItem)
    }
    return nextItems
  })

  const handleOutlinerClick = (promptId: string) => {
    if (!scrollToAndTrackRowCentered) return
    outlinerManualSelectionActive = true
    activeOutlinerRow = { kind: 'prompt', promptId }
    outlinerAutoScrollRequestId += 1
    scrollToAndTrackRowCentered(promptEditorRowId(promptId))
  }

  const handleOutlinerFolderSettingsClick = () => {
    if (!scrollToAndTrackRowCentered) return
    outlinerManualSelectionActive = true
    activeOutlinerRow = { kind: 'folder-settings' }
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
    const now = new Date().toISOString()
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

  const handleDeletePrompt = (promptId: string) => {
    const currentPromptFolderId = promptFolder?.id
    if (!currentPromptFolderId) {
      return
    }

    void runIpcBestEffort(async () => {
      await deletePrompt(currentPromptFolderId, promptId)
    })
  }

  const handleMovePromptUp = async (promptId: string): Promise<boolean> => {
    const currentPromptIds = promptFolder?.promptIds ?? []
    const currentIndex = currentPromptIds.indexOf(promptId)
    if (currentIndex <= 0) {
      return false
    }

    const previousPromptId = currentIndex <= 1 ? null : currentPromptIds[currentIndex - 2]
    return await reorderPromptInFolder(promptId, previousPromptId)
  }

  const handleMovePromptDown = async (promptId: string): Promise<boolean> => {
    const currentPromptIds = promptFolder?.promptIds ?? []
    const currentIndex = currentPromptIds.indexOf(promptId)
    if (currentIndex === -1 || currentIndex >= currentPromptIds.length - 1) {
      return false
    }

    const previousPromptId = currentPromptIds[currentIndex + 1]
    return await reorderPromptInFolder(promptId, previousPromptId)
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

    const measuredHeight = lookupPromptFolderDescriptionMeasuredHeightForScreen(
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
</script>

<PromptFolderFindIntegration
  items={findItems}
  scrollToWithinWindowBand={scrollToWithinWindowBandWithManualClear}
>
  <main class="relative flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
    <div class="flex h-9 border-b border-border" style="background-color: #1F1F1F;">
      <div
        class="h-full shrink-0 border-r border-border"
        style={`width: ${sidebarWidthPx}px`}
        aria-hidden="true"
      ></div>
      <div class="flex-1 min-w-0 flex items-center pl-6">
        <div class="flex min-w-0 items-center text-lg font-semibold">
          <button
            type="button"
            class="min-w-0 truncate underline text-foreground/85 transition-colors hover:text-foreground"
            onclick={() => handleHeaderSegmentClick('folder-settings')}
          >
            {folderDisplayName}
          </button>
          <span class="mx-2">/</span>
          <button
            type="button"
            class="underline whitespace-nowrap text-foreground/85 transition-colors hover:text-foreground"
            onclick={() => handleHeaderSegmentClick(activeHeaderRowId)}
          >
            {activeHeaderSection}
          </button>
        </div>
      </div>
    </div>
    <div class="flex-1 min-h-0 flex">
      <ResizableSidebar
        defaultWidth={promptOutlinerDefaultWidthPx}
        minWidth={100}
        maxWidth={400}
        containerClass="h-full"
        handleTestId="prompt-outliner-resize-handle"
        sidebarInsetYPx={16}
        sidebarBorderClass="border-border/50"
        onWidthChange={(nextWidth) => {
          sidebarWidthPx = nextWidth
        }}
        onDesiredWidthChange={(nextDesiredWidth) => {
          setPromptOutlinerWidthWithAutosave(nextDesiredWidth)
        }}
      >
        {#snippet sidebar()}
          <PromptFolderOutliner
            promptIds={visiblePromptIds}
            {errorMessage}
            activeRow={activeOutlinerRow}
            autoScrollRequestId={outlinerAutoScrollRequestId}
            onSelectPrompt={handleOutlinerClick}
            onSelectFolderSettings={handleOutlinerFolderSettingsClick}
          />
        {/snippet}

        {#snippet content()}
          {#if errorMessage}
            <div class="flex-1 min-h-0 overflow-y-auto">
              <div class="pt-6 pl-6">
                <h2 class="text-lg font-semibold mb-4">Prompts ({visiblePromptIds.length})</h2>
                <p class="mt-6 text-red-500">Error loading prompts: {errorMessage}</p>
              </div>
            </div>
          {:else}
            <SvelteVirtualWindow
              items={virtualItems}
              {rowRegistry}
              testId="prompt-folder-virtual-window"
              spacerTestId="prompt-folder-virtual-window-spacer"
              bind:scrollToWithinWindowBand
              bind:scrollToAndTrackRowCentered
              bind:scrollApi
              bind:viewportMetrics
              onScrollTopChange={(nextScrollTop) => {
                scrollTopPx = nextScrollTop
                if (!hasRestoredScrollTopForCurrentFolder) return
                recordPromptFolderScrollTop(promptFolderId, nextScrollTop)
              }}
              onCenterRowChange={(row) => {
                if (row?.kind === 'prompt-editor') {
                  latestCenteredOutlinerRow = { kind: 'prompt', promptId: row.promptId }
                } else if (row?.kind === 'folder-settings') {
                  latestCenteredOutlinerRow = { kind: 'folder-settings' }
                } else {
                  latestCenteredOutlinerRow = null
                }
                if (outlinerManualSelectionActive) return
                activeOutlinerRow = latestCenteredOutlinerRow
              }}
              onUserScroll={() => {
                clearOutlinerManualSelection()
                outlinerAutoScrollRequestId += 1
                if (latestCenteredOutlinerRow) {
                  activeOutlinerRow = latestCenteredOutlinerRow
                }
              }}
            />
          {/if}
        {/snippet}
      </ResizableSidebar>
    </div>
    {#if loadingOverlay.isVisible()}
      <LoadingOverlay
        testId="prompt-folder-loading-overlay"
        fadeMs={LOADING_OVERLAY_FADE_MS}
        isFading={loadingOverlay.isFading()}
        message="Loading prompt folder..."
      />
    {/if}
  </main>
</PromptFolderFindIntegration>

{#snippet folderSettingsRow(props)}
  <PromptFolderSettingsRow
    {promptFolderId}
    rowId={props.rowId}
    virtualWindowWidthPx={props.virtualWindowWidthPx}
    devicePixelRatio={props.devicePixelRatio}
    rowHeightPx={props.rowHeightPx}
    hydrationPriority={props.hydrationPriority}
    shouldDehydrate={props.shouldDehydrate}
    overlayRowElement={props.overlayRowElement ?? null}
    scrollToWithinWindowBand={scrollToWithinWindowBandWithManualClear}
    onHydrationChange={props.onHydrationChange}
    {descriptionText}
    onDescriptionChange={handleDescriptionChange}
  />
{/snippet}

{#snippet promptHeaderRow({ row })}
  <div class="pt-6 pb-4" data-virtual-window-row>
    <h2 class="text-lg font-semibold">Prompts ({row.promptCount})</h2>
  </div>
{/snippet}

{#snippet placeholderRow()}
  <div class="text-center py-12 text-muted-foreground">
    <p>No prompts found in this folder.</p>
    <p class="text-sm mt-2">Click the + button to create your first prompt.</p>
  </div>
{/snippet}

{#snippet dividerRow({ row })}
  <PromptDivider
    disabled={isCreatingPrompt}
    onAddPrompt={() => handleAddPrompt(row.previousPromptId)}
    testId={row.previousPromptId
      ? `prompt-divider-add-after-${row.previousPromptId}`
      : 'prompt-divider-add-initial'}
  />
{/snippet}

{#snippet promptEditorRow({
  row,
  rowId,
  virtualWindowWidthPx,
  devicePixelRatio,
  rowHeightPx,
  hydrationPriority,
  shouldDehydrate,
  overlayRowElement,
  onHydrationChange
}: PromptEditorRowProps)}
  <PromptEditorRow
    promptId={row.promptId}
    promptDraftRecord={promptDraftById[row.promptId]!}
    {rowId}
    {virtualWindowWidthPx}
    {devicePixelRatio}
    {rowHeightPx}
    {hydrationPriority}
    {shouldDehydrate}
    {overlayRowElement}
    {onHydrationChange}
    scrollToWithinWindowBand={scrollToWithinWindowBandWithManualClear}
    focusRequest={promptFocusRequest}
    onDelete={() => handleDeletePrompt(row.promptId)}
    onMoveUp={() => handleMovePromptUp(row.promptId)}
    onMoveDown={() => handleMovePromptDown(row.promptId)}
  />
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
