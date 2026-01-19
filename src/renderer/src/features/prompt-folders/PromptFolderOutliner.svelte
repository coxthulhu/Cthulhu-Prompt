<script lang="ts">
  import { getPromptData } from '@renderer/data/PromptDataStore.svelte.ts'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem
  } from '../virtualizer/virtualWindowTypes'

  type Props = {
    promptIds: string[]
    isLoading: boolean
    errorMessage: string | null
    activePromptId: string | null
    onSelectPrompt: (promptId: string) => void
  }

  let { promptIds, isLoading, errorMessage, activePromptId, onSelectPrompt }: Props = $props()

  type OutlinerRow = { kind: 'loading' } | { kind: 'prompt'; promptId: string }
  const OUTLINER_ROW_HEIGHT_PX = 28
  const OUTLINER_ROW_CENTER_OFFSET_PX = OUTLINER_ROW_HEIGHT_PX / 2
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)

  const outlinerRowRegistry = defineVirtualWindowRowRegistry<OutlinerRow>({
    loading: {
      estimateHeight: () => 32,
      snippet: outlinerLoadingRow
    },
    prompt: {
      estimateHeight: () => 28,
      snippet: outlinerPromptRow
    }
  })

  const outlinerItems = $derived.by((): VirtualWindowItem<OutlinerRow>[] => {
    if (errorMessage) return []
    if (isLoading) {
      return [{ id: 'outliner-loading', row: { kind: 'loading' } }]
    }

    return promptIds.map((promptId) => ({
      id: `outliner-${promptId}`,
      row: { kind: 'prompt', promptId }
    }))
  })

  const getPromptDisplayTitle = (promptId: string): string => {
    const promptData = getPromptData(promptId)
    const trimmedTitle = promptData.draft.title.trim()
    return trimmedTitle.length > 0 ? trimmedTitle : `Prompt ${promptData.promptFolderCount}`
  }

  // Side effect: keep the active prompt row within the outliner scroll band.
  $effect(() => {
    if (!scrollToWithinWindowBand || !activePromptId || outlinerItems.length === 0) return
    scrollToWithinWindowBand(
      `outliner-${activePromptId}`,
      OUTLINER_ROW_CENTER_OFFSET_PX,
      'minimal'
    )
  })
</script>

<div class="flex h-full flex-col bg-muted/10">
  <div class="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
    Outliner
  </div>
  <div class="flex-1 min-h-0">
    <SvelteVirtualWindow
      items={outlinerItems}
      rowRegistry={outlinerRowRegistry}
      testId="prompt-outliner-virtual-window"
      spacerTestId="prompt-outliner-virtual-window-spacer"
      onScrollToWithinWindowBand={(next) => {
        scrollToWithinWindowBand = next
      }}
    />
  </div>
</div>

{#snippet outlinerLoadingRow({ row })}
  <div class="px-3 py-2 text-xs text-muted-foreground" data-kind={row.kind}>
    Loading prompts...
  </div>
{/snippet}

{#snippet outlinerPromptRow({ row })}
  {@const isActive = activePromptId === row.promptId}
  <button
    type="button"
    class={`flex h-7 w-full items-center rounded-sm px-3 text-xs ${
      isActive
        ? 'bg-accent text-accent-foreground'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
    }`}
    aria-current={isActive ? 'true' : undefined}
    onclick={() => onSelectPrompt(row.promptId)}
  >
    <span class="min-w-0 flex-1 truncate">{getPromptDisplayTitle(row.promptId)}</span>
  </button>
{/snippet}
