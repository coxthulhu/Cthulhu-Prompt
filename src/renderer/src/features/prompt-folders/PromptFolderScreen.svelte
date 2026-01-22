<script lang="ts">
  import { untrack } from 'svelte'
  import type { PromptFolder } from '@shared/ipc'
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
  import PromptFolderHeaderRow from './PromptFolderHeaderRow.svelte'
  import { estimatePromptFolderHeaderHeight } from './promptFolderDescriptionSizing'
  import PromptFolderOutliner from './PromptFolderOutliner.svelte'

  let { folder } = $props<{ folder: PromptFolder }>()
  const folderName = $derived(folder.folderName)
  const initialFolderData = getPromptFolderData(untrack(() => folder.folderName))
  let folderData = $state(initialFolderData)

  let previousFolderName = $state<string | null>(null)
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  let activeOutlinerRow = $state<ActiveOutlinerRow | null>(null)
  let outlinerAutoScrollRequestId = $state(0)
  let sidebarWidthPx = $state(200)
  let scrollResetVersion = $state(0)
  let lastScrollResetVersion = 0

  // Side effect: reload prompts on folder change.
  $effect(() => {
    const nextFolderName = folderName

    if (previousFolderName === nextFolderName) return
    previousFolderName = nextFolderName
    folderData = getPromptFolderData(nextFolderName)
    void loadPromptFolder(nextFolderName)
    scrollResetVersion += 1
  })

  // Side effect: reset the virtual window scroll position after folder changes.
  $effect(() => {
    if (!scrollApi) return
    if (scrollResetVersion === lastScrollResetVersion) return
    lastScrollResetVersion = scrollResetVersion
    scrollApi.scrollTo(0)
  })

  type PromptFolderRow =
    | { kind: 'header'; promptCount: number; isLoading: boolean; folder: PromptFolder }
    | { kind: 'placeholder'; messageKind: 'loading' | 'empty' }
    | { kind: 'prompt-divider'; previousPromptId: string | null }
    | { kind: 'prompt-editor'; promptId: string }
    | { kind: 'bottom-spacer' }

  type PromptEditorRowProps = VirtualWindowRowComponentProps<
    Extract<PromptFolderRow, { kind: 'prompt-editor' }>
  >
  type ActiveOutlinerRow =
    | { kind: 'folder-description' }
    | { kind: 'prompt'; promptId: string }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    header: {
      estimateHeight: () => estimatePromptFolderHeaderHeight(folderData.descriptionDraft.text),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) =>
        lookupPromptFolderDescriptionMeasuredHeight(
          row.folder.folderName,
          widthPx,
          devicePixelRatio
        ),
      needsOverlayRow: true,
      snippet: headerRow
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
        estimatePromptEditorHeight(getPromptData(row.promptId).draft.text, widthPx, heightPx),
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
        id: 'header',
        row: {
          kind: 'header',
          promptCount: promptIds.length,
          isLoading,
          folder
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
    activeOutlinerRow = { kind: 'prompt', promptId }
    outlinerAutoScrollRequestId += 1
    scrollToAndTrackRowCentered(promptEditorRowId(promptId))
  }

  const handleOutlinerFolderDescriptionClick = () => {
    if (!scrollToAndTrackRowCentered) return
    activeOutlinerRow = { kind: 'folder-description' }
    outlinerAutoScrollRequestId += 1
    scrollToAndTrackRowCentered('header')
  }

  const handleAddPrompt = (previousPromptId: string | null) => {
    void createPromptInFolder(folder.folderName, previousPromptId)
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
</script>

<PromptFolderFindIntegration
  promptIds={folderData.promptIds}
  scrollToWithinWindowBand={scrollToWithinWindowBand}
>
  <main class="flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
    <div class="flex h-9 border-b border-border bg-background">
      <div class="h-full shrink-0" style={`width: ${sidebarWidthPx}px`} aria-hidden="true"></div>
      <div class="flex-1 min-w-0 flex items-center pl-6">
        <div class="truncate text-lg font-bold">{folder.displayName}</div>
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
              onSelectFolderDescription={handleOutlinerFolderDescriptionClick}
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
                row.kind === 'prompt-editor' || row.kind === 'header'}
              bind:scrollToWithinWindowBand
              bind:scrollToAndTrackRowCentered
              bind:scrollApi
              bind:viewportMetrics
              onCenterRowChange={(row) => {
                if (row?.kind === 'prompt-editor') {
                  activeOutlinerRow = { kind: 'prompt', promptId: row.promptId }
                  return
                }
                if (row?.kind === 'header') {
                  activeOutlinerRow = { kind: 'folder-description' }
                  return
                }
                activeOutlinerRow = null
              }}
              onUserScroll={() => {
                outlinerAutoScrollRequestId += 1
              }}
            />
          {/if}
        {/snippet}
      </ResizableSidebar>
    </div>
  </main>
</PromptFolderFindIntegration>

{#snippet headerRow(props)}
  <PromptFolderHeaderRow
    promptCount={props.row.promptCount}
    isLoading={props.row.isLoading}
    rowId={props.rowId}
    virtualWindowWidthPx={props.virtualWindowWidthPx}
    devicePixelRatio={props.devicePixelRatio}
    hydrationPriority={props.hydrationPriority}
    shouldDehydrate={props.shouldDehydrate}
    overlayRowElement={props.overlayRowElement ?? null}
    scrollToWithinWindowBand={props.scrollToWithinWindowBand}
    onHydrationChange={props.onHydrationChange}
    {folderData}
  />
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
    testId={
      row.previousPromptId
        ? `prompt-divider-add-after-${row.previousPromptId}`
        : 'prompt-divider-add-initial'
    }
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
  scrollToWithinWindowBand,
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
    {scrollToWithinWindowBand}
    onDelete={() => handleDeletePrompt(row.promptId)}
    onMoveUp={() => handleMovePromptUp(row.promptId)}
    onMoveDown={() => handleMovePromptDown(row.promptId)}
  />
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
