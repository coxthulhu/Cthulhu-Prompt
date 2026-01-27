<script lang="ts">
  import { untrack } from 'svelte'
  import type { PromptFolder } from '@shared/ipc'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import PromptEditorRow from '../prompt-editor/PromptEditorRow.svelte'
  import { estimatePromptEditorHeight } from '../prompt-editor/promptEditorSizing'
  import {
    getPromptData,
    lookupPromptEditorMeasuredHeight
  } from '@renderer/data/PromptDataStore.svelte.ts'
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
  import {
    getPromptFolderData,
    loadPromptFolder,
    createPromptInFolder,
    deletePromptInFolder,
    movePromptDownInFolder,
    movePromptUpInFolder,
    lookupPromptFolderDescriptionMeasuredHeight
  } from '@renderer/data/PromptFolderDataStore.svelte.ts'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import { promptEditorRowId } from './promptFolderRowIds'
  import PromptFolderSettingsRow from './PromptFolderSettingsRow.svelte'
  import {
    estimatePromptFolderSettingsHeight,
    PROMPT_HEADER_ROW_HEIGHT_PX
  } from './promptFolderSettingsSizing'
  import PromptFolderOutliner from './PromptFolderOutliner.svelte'

  let { folder } = $props<{ folder: PromptFolder }>()
  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)
  const folderName = $derived(folder.folderName)
  const initialFolderData = getPromptFolderData(untrack(() => folder.folderName))
  let folderData = $state(initialFolderData)

  let previousFolderName = $state<string | null>(null)
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

  // Side effect: reload prompts and select the folder settings row after folder changes.
  $effect(() => {
    const nextFolderName = folderName

    if (previousFolderName === nextFolderName) return
    previousFolderName = nextFolderName
    folderData = getPromptFolderData(nextFolderName)
    void loadPromptFolder(nextFolderName)
    scrollResetVersion += 1
    activeOutlinerRow = { kind: 'folder-settings' }
    outlinerManualSelectionActive = true
    outlinerAutoScrollRequestId += 1
  })

  // Side effect: reset the virtual window scroll position after folder changes.
  $effect(() => {
    if (!scrollApi) return
    if (scrollResetVersion === lastScrollResetVersion) return
    lastScrollResetVersion = scrollResetVersion
    scrollApi.scrollTo(0)
  })

  type PromptFolderRow =
    | { kind: 'folder-settings'; isLoading: boolean; folder: PromptFolder }
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
        estimatePromptFolderSettingsHeight(
          folderData.descriptionDraft.text,
          promptFontSize,
          promptEditorMinLines
        ),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) =>
        lookupPromptFolderDescriptionMeasuredHeight(
          row.folder.folderName,
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
          getPromptData(row.promptId).draft.text,
          widthPx,
          heightPx,
          promptFontSize,
          promptEditorMinLines
        ),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) =>
        lookupPromptEditorMeasuredHeight(row.promptId, widthPx, devicePixelRatio),
      needsOverlayRow: true,
      snippet: promptEditorRow
    },
    'bottom-spacer': {
      estimateHeight: (_row, _widthPx, heightPx) => getBottomSpacerHeightPx(heightPx),
      snippet: bottomSpacerRow
    }
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptFolderRow>[] => {
    const promptIds = folderData.promptIds
    const isLoading = folderData.isLoading
    const rows: VirtualWindowItem<PromptFolderRow>[] = [
      {
        id: 'folder-settings',
        row: {
          kind: 'folder-settings',
          isLoading,
          folder
        }
      },
      {
        id: 'prompt-header',
        row: {
          kind: 'prompt-header',
          promptCount: promptIds.length,
          isLoading
        }
      }
    ]

    if (isLoading) {
      rows.push({
        id: 'placeholder-loading',
        row: { kind: 'placeholder', messageKind: 'loading' }
      })
    } else if (promptIds.length === 0) {
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

      promptIds.forEach((promptId) => {
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
    const promptId = await createPromptInFolder(folder.folderName, previousPromptId)
    if (!promptId) return
    promptFocusRequestId += 1
    promptFocusRequest = { promptId, requestId: promptFocusRequestId }
  }

  const handleDeletePrompt = (promptId: string) => {
    void deletePromptInFolder(folder.folderName, promptId)
  }

  const handleMovePromptUp = (promptId: string) => {
    return movePromptUpInFolder(folder.folderName, promptId)
  }

  const handleMovePromptDown = (promptId: string) => {
    return movePromptDownInFolder(folder.folderName, promptId)
  }

  const folderSettingsHeightPx = $derived.by(() => {
    const baseHeight = estimatePromptFolderSettingsHeight(
      folderData.descriptionDraft.text,
      promptFontSize,
      promptEditorMinLines
    )
    if (!viewportMetrics) return baseHeight
    const measuredHeight = lookupPromptFolderDescriptionMeasuredHeight(
      folderName,
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
  promptIds={folderData.promptIds}
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
            {folder.displayName}
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
            promptIds={folderData.promptIds}
            isLoading={folderData.isLoading}
            errorMessage={folderData.errorMessage}
            activeRow={activeOutlinerRow}
            autoScrollRequestId={outlinerAutoScrollRequestId}
            onSelectPrompt={handleOutlinerClick}
            onSelectFolderSettings={handleOutlinerFolderSettingsClick}
          />
        {/snippet}

        {#snippet content()}
          {#if folderData.errorMessage}
            <div class="flex-1 min-h-0 overflow-y-auto">
              <div class="pt-6 pl-6">
                <h2 class="text-lg font-semibold mb-4">
                  Prompts ({folderData.isLoading ? 0 : folderData.promptIds.length})
                </h2>
                <p class="mt-6 text-red-500">Error loading prompts: {folderData.errorMessage}</p>
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
    rowId={props.rowId}
    virtualWindowWidthPx={props.virtualWindowWidthPx}
    devicePixelRatio={props.devicePixelRatio}
    hydrationPriority={props.hydrationPriority}
    shouldDehydrate={props.shouldDehydrate}
    overlayRowElement={props.overlayRowElement ?? null}
    scrollToWithinWindowBand={scrollToWithinWindowBandWithManualClear}
    onHydrationChange={props.onHydrationChange}
    {folderData}
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
    disabled={folderData.isCreatingPrompt}
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
  virtualWindowHeightPx,
  devicePixelRatio,
  measuredHeightPx,
  hydrationPriority,
  shouldDehydrate,
  overlayRowElement,
  onHydrationChange
}: PromptEditorRowProps)}
  <PromptEditorRow
    promptId={row.promptId}
    {rowId}
    {virtualWindowWidthPx}
    {virtualWindowHeightPx}
    {devicePixelRatio}
    {measuredHeightPx}
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
