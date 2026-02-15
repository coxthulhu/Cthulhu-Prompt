<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import type { Prompt } from '@shared/Prompt'
  import type { PromptFolder } from '@shared/PromptFolder'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import {
    createPromptDraftMeasuredHeightKey,
    type PromptDraftRecord,
    promptDraftCollection
  } from '@renderer/data/Collections/PromptDraftCollection'
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { loadPromptFolderInitial } from '@renderer/data/Queries/PromptFolderQuery'
  import {
    createPrompt,
    deletePrompt
  } from '@renderer/data/Mutations/PromptMutations'
  import { reorderPromptFolderPrompts } from '@renderer/data/Mutations/PromptFolderMutations'
  import {
    getPromptFolderScreenDescriptionText,
    getPromptFolderScreenPromptData,
    lookupPromptFolderScreenDescriptionMeasuredHeight,
    removePromptFolderScreenPrompt,
    setPromptFolderScreenDescriptionText,
    syncPromptFolderScreenDescriptionDraft,
    syncPromptFolderScreenPromptDraft,
    syncPromptFolderScreenPromptDrafts
  } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
  import PromptEditorRow from '../prompt-editor/PromptEditorRow.svelte'
  import { estimatePromptEditorHeight } from '../prompt-editor/promptEditorSizing'
  import PromptDivider from '../prompt-editor/PromptDivider.svelte'
  import BottomSpacer, { getBottomSpacerHeightPx } from '../prompt-editor/BottomSpacer.svelte'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import ResizableSidebar from '../sidebar/ResizableSidebar.svelte'
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
  import { promptEditorRowId } from './promptFolderRowIds'
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
    isLoading: boolean
  }
  const promptQuery = useLiveQuery(promptCollection) as {
    data: Prompt[]
    isLoading: boolean
  }
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
    isLoading: boolean
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
  const promptIds = $derived(promptFolder?.promptIds ?? [])
  const descriptionText = $derived(getPromptFolderScreenDescriptionText(promptFolderId))
  const folderDisplayName = $derived(promptFolder?.displayName ?? 'Prompt Folder')

  let previousPromptFolderLoadKey = $state<string | null>(null)
  let promptFolderLoadRequestId = $state(0)
  let isLoading = $state(true)
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
  let sidebarWidthPx = $state(200)
  let scrollResetVersion = $state(0)
  let lastScrollResetVersion = 0
  let scrollTopPx = $state(0)

  type PromptFocusRequest = { promptId: string; requestId: number }
  let promptFocusRequest = $state<PromptFocusRequest | null>(null)
  let promptFocusRequestId = $state(0)

  const visiblePromptIds = $derived(errorMessage ? [] : isLoading ? [] : promptIds)

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
    scrollResetVersion += 1
    activeOutlinerRow = { kind: 'folder-settings' }
    outlinerManualSelectionActive = true
    outlinerAutoScrollRequestId += 1
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
    isLoading = true
    isCreatingPrompt = false
    errorMessage = null
    resetPromptFolderUiState()

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

  // Side effect: keep the folder-description draft state synced with collection updates.
  $effect(() => {
    const currentPromptFolder = promptFolder
    if (!currentPromptFolder) return
    syncPromptFolderScreenDescriptionDraft(currentPromptFolder)
  })

  // Side effect: keep prompt drafts synced with collection updates for rows in the active folder.
  $effect(() => {
    const currentPromptIds = promptIds
    if (currentPromptIds.length === 0) return

    const promptById = new Map(promptQuery.data.map((prompt) => [prompt.id, prompt]))
    const promptsToSync: Prompt[] = []
    for (const promptId of currentPromptIds) {
      const prompt = promptById.get(promptId)
      if (!prompt) continue
      promptsToSync.push(prompt)
    }

    if (promptsToSync.length === 0) {
      return
    }

    syncPromptFolderScreenPromptDrafts(promptsToSync, { createMissing: false })
  })

  // Side effect: reset the virtual window scroll position after folder changes.
  $effect(() => {
    if (!scrollApi) return
    if (scrollResetVersion === lastScrollResetVersion) return
    lastScrollResetVersion = scrollResetVersion
    scrollApi.scrollTo(0)
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

    try {
      await reorderPromptFolderPrompts(currentPromptFolder.id, nextPromptIds)
      return true
    } catch {
      // Intentionally ignore reorder errors to keep the UI quiet.
      return false
    }
  }

  type PromptFolderRow =
    | { kind: 'folder-settings'; isLoading: boolean }
    | { kind: 'prompt-header'; promptCount: number; isLoading: boolean }
    | { kind: 'placeholder'; messageKind: 'loading' | 'empty' }
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
        lookupPromptFolderScreenDescriptionMeasuredHeight(
          promptFolderId,
          widthPx,
          devicePixelRatio
        ),
      needsOverlayRow: true,
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
          promptDraftById[row.promptId]?.draftSnapshot.promptText ??
            getPromptFolderScreenPromptData(row.promptId).draft.text,
          widthPx,
          heightPx,
          promptFontSize,
          promptEditorMinLines
        ),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        const promptDraftRecord = promptDraftById[row.promptId]
        if (!promptDraftRecord) {
          return null
        }

        const key = createPromptDraftMeasuredHeightKey(widthPx, devicePixelRatio)
        return promptDraftRecord.promptEditorMeasuredHeightsByKey[key] ?? null
      },
      needsOverlayRow: true,
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
          kind: 'folder-settings',
          isLoading
        }
      },
      {
        id: 'prompt-header',
        row: {
          kind: 'prompt-header',
          promptCount: visiblePromptIds.length,
          isLoading
        }
      }
    ]

    if (isLoading) {
      rows.push({
        id: 'placeholder-loading',
        row: { kind: 'placeholder', messageKind: 'loading' }
      })
    } else if (visiblePromptIds.length === 0) {
      rows.push({
        id: 'divider-initial',
        row: { kind: 'prompt-divider', previousPromptId: null }
      })
      rows.push({
        id: 'placeholder-empty',
        row: { kind: 'placeholder', messageKind: 'empty' }
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
    const promptId = window.crypto.randomUUID()
    const now = new Date().toISOString()
    const optimisticPrompt: Prompt = {
      id: promptId,
      title: '',
      creationDate: now,
      lastModifiedDate: now,
      promptText: '',
      promptFolderCount: currentPromptFolder.promptCount + 1
    }
    syncPromptFolderScreenPromptDraft(optimisticPrompt)

    try {
      await createPrompt(currentPromptFolder.id, optimisticPrompt, previousPromptId)
      promptFocusRequestId += 1
      promptFocusRequest = { promptId, requestId: promptFocusRequestId }
    } catch {
      // Intentionally ignore create errors to keep the UI quiet.
      removePromptFolderScreenPrompt(promptId)
    } finally {
      isCreatingPrompt = false
    }
  }

  const handleDeletePrompt = (promptId: string) => {
    const currentPromptFolderId = promptFolder?.id
    if (!currentPromptFolderId) {
      return
    }

    void (async () => {
      try {
        await deletePrompt(currentPromptFolderId, promptId)
      } catch {
        // Intentionally ignore delete errors to keep the UI quiet.
      } finally {
        if (!promptCollection.get(promptId)) {
          removePromptFolderScreenPrompt(promptId)
        }
      }
    })()
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
    setPromptFolderScreenDescriptionText(promptFolderId, text, measurement)
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

    const measuredHeight = lookupPromptFolderScreenDescriptionMeasuredHeight(
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
</script>

<PromptFolderFindIntegration
  promptIds={visiblePromptIds}
  scrollToWithinWindowBand={scrollToWithinWindowBandWithManualClear}
>
  <main class="flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
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
        defaultWidth={200}
        minWidth={100}
        maxWidth={400}
        containerClass="h-full"
        handleTestId="prompt-outliner-resize-handle"
        sidebarInsetYPx={16}
        sidebarBorderClass="border-border/50"
        onWidthChange={(nextWidth) => {
          sidebarWidthPx = nextWidth
        }}
      >
        {#snippet sidebar()}
          <PromptFolderOutliner
            promptIds={visiblePromptIds}
            {isLoading}
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
                <h2 class="text-lg font-semibold mb-4">Prompts ({isLoading ? 0 : visiblePromptIds.length})</h2>
                <p class="mt-6 text-red-500">Error loading prompts: {errorMessage}</p>
              </div>
            </div>
          {:else}
            <SvelteVirtualWindow
              items={virtualItems}
              {rowRegistry}
              testId="prompt-folder-virtual-window"
              spacerTestId="prompt-folder-virtual-window-spacer"
              getHydrationPriorityEligibility={(row) => row.kind === 'prompt-editor'}
              getCenterRowEligibility={(row) =>
                row.kind === 'prompt-editor' || row.kind === 'folder-settings'}
              bind:scrollToWithinWindowBand
              bind:scrollToAndTrackRowCentered
              bind:scrollApi
              bind:viewportMetrics
              onScrollTopChange={(nextScrollTop) => {
                scrollTopPx = nextScrollTop
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
  </main>
</PromptFolderFindIntegration>

{#snippet folderSettingsRow(props)}
  <PromptFolderSettingsRow
    isLoading={props.row.isLoading}
    {promptFolderId}
    rowId={props.rowId}
    virtualWindowWidthPx={props.virtualWindowWidthPx}
    devicePixelRatio={props.devicePixelRatio}
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
    <h2 class="text-lg font-semibold">Prompts ({row.isLoading ? 0 : row.promptCount})</h2>
  </div>
{/snippet}

{#snippet placeholderRow({ row })}
  <div class="text-center py-12 text-muted-foreground">
    {#if row.messageKind === 'loading'}
      <p>Loading prompts...</p>
    {:else}
      <p>No prompts found in this folder.</p>
      <p class="text-sm mt-2">Click the + button to create your first prompt.</p>
    {/if}
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
    promptDraftRecord={promptDraftById[row.promptId] ?? null}
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
