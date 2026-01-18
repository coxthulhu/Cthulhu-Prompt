<script lang="ts">
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
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps
  } from '../virtualizer/virtualWindowTypes'
  import {
    getPromptFolderData,
    loadPromptFolder,
    createPromptInFolder,
    deletePromptInFolder,
    movePromptDownInFolder,
    movePromptUpInFolder,
    type PromptFolderData
  } from '@renderer/data/PromptFolderDataStore.svelte.ts'
  import PromptFolderFindIntegration from './PromptFolderFindIntegration.svelte'

  let { folder } = $props<{ folder: PromptFolder }>()
  let folderData = $state<PromptFolderData>({
    promptIds: [],
    isLoading: true,
    isCreatingPrompt: false,
    errorMessage: null,
    requestId: 0
  })

  let previousFolderName = $state<string | null>(null)
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)

  // Side effect: reload prompts on folder change.
  $effect(() => {
    const folderName = folder.folderName
    const nextFolderData = getPromptFolderData(folderName)
    folderData = nextFolderData

    if (previousFolderName !== folderName) {
      previousFolderName = folderName
      void loadPromptFolder(folderName)
    }
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

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    header: {
      estimateHeight: () => 164,
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
        rows.push({ id: `${promptId}-editor`, row: { kind: 'prompt-editor', promptId } })
        rows.push({
          id: `${promptId}-divider`,
          row: { kind: 'prompt-divider', previousPromptId: promptId }
        })
      })
    }

    rows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return rows
  })

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
    {#if folderData.errorMessage}
      <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="pt-6 pl-6">
          <h1 class="text-2xl font-bold">{folder.displayName}</h1>
          <p class="mt-4 text-muted-foreground">
            Edit prompts in the "{folder.displayName}" folder.
          </p>
          <h2 class="mt-6 text-lg font-semibold mb-4">
            Prompts ({folderData.isLoading ? 0 : folderData.promptIds.length})
          </h2>
          <p class="mt-6 text-red-500">Error loading prompts: {folderData.errorMessage}</p>
        </div>
      </div>
    {:else}
      <div class="flex-1 min-h-0 flex">
        <SvelteVirtualWindow
          items={virtualItems}
          {rowRegistry}
          getHydrationPriorityEligibility={(row) => row.kind === 'prompt-editor'}
          onScrollToWithinWindowBand={(next) => {
            scrollToWithinWindowBand = next
          }}
        />
      </div>
    {/if}
  </main>
</PromptFolderFindIntegration>

{#snippet headerRow({ row })}
  <div class="pt-6">
    <h1 class="text-2xl font-bold">{row.folder.displayName}</h1>
    <p class="mt-4 text-muted-foreground">
      Edit prompts in the "{row.folder.displayName}" folder.
    </p>
    <h2 class="mt-6 text-lg font-semibold mb-4">
      Prompts ({row.isLoading ? 0 : row.promptCount})
    </h2>
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
