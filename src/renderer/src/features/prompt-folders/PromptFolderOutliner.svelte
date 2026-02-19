<script lang="ts">
  import { getPromptFolderScreenPromptData } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem
  } from '../virtualizer/virtualWindowTypes'

  type Props = {
    promptIds: string[]
    errorMessage: string | null
    activeRow: OutlinerActiveRow | null
    autoScrollRequestId: number
    onSelectPrompt: (promptId: string) => void
    onSelectFolderSettings: () => void
  }

  let {
    promptIds,
    errorMessage,
    activeRow,
    autoScrollRequestId,
    onSelectPrompt,
    onSelectFolderSettings
  }: Props = $props()

  type OutlinerRow = { kind: 'folder-settings' } | { kind: 'prompt'; promptId: string }
  type OutlinerActiveRow = { kind: 'folder-settings' } | { kind: 'prompt'; promptId: string }
  const OUTLINER_ROW_HEIGHT_PX = 28
  const OUTLINER_ROW_CENTER_OFFSET_PX = OUTLINER_ROW_HEIGHT_PX / 2
  const OUTLINER_FOLDER_SETTINGS_ROW_ID = 'outliner-folder-settings'
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let lastAutoScrollRequestId = $state(0)

  const outlinerRowRegistry = defineVirtualWindowRowRegistry<OutlinerRow>({
    'folder-settings': {
      estimateHeight: () => 28,
      snippet: outlinerFolderSettingsRow
    },
    prompt: {
      estimateHeight: () => 28,
      snippet: outlinerPromptRow
    }
  })

  const outlinerItems = $derived.by((): VirtualWindowItem<OutlinerRow>[] => {
    if (errorMessage) return []

    const items: VirtualWindowItem<OutlinerRow>[] = [
      { id: OUTLINER_FOLDER_SETTINGS_ROW_ID, row: { kind: 'folder-settings' } }
    ]
    promptIds.forEach((promptId) => {
      items.push({ id: `outliner-${promptId}`, row: { kind: 'prompt', promptId } })
    })
    return items
  })

  const getPromptDisplayTitle = (promptId: string): string => {
    const promptData = getPromptFolderScreenPromptData(promptId)
    const trimmedTitle = promptData.draft.title.trim()
    return trimmedTitle.length > 0 ? trimmedTitle : `Prompt ${promptData.promptFolderCount}`
  }

  const getActiveOutlinerRowId = (row: OutlinerActiveRow | null): string | null => {
    if (!row) return null
    if (row.kind === 'folder-settings') return OUTLINER_FOLDER_SETTINGS_ROW_ID
    return `outliner-${row.promptId}`
  }

  // Side effect: keep the active outliner row within the outliner scroll band when requested.
  $effect(() => {
    if (!scrollToWithinWindowBand || outlinerItems.length === 0) return
    if (autoScrollRequestId === lastAutoScrollRequestId) return
    const activeRowId = getActiveOutlinerRowId(activeRow)
    if (!activeRowId) return
    lastAutoScrollRequestId = autoScrollRequestId
    scrollToWithinWindowBand(activeRowId, OUTLINER_ROW_CENTER_OFFSET_PX, 'minimal')
  })
</script>

<div class="flex h-full flex-col bg-background text-left">
  <div class="flex-1 min-h-0">
    <SvelteVirtualWindow
      items={outlinerItems}
      rowRegistry={outlinerRowRegistry}
      leftScrollPaddingPx={12}
      testId="prompt-outliner-virtual-window"
      spacerTestId="prompt-outliner-virtual-window-spacer"
      bind:scrollToWithinWindowBand
    />
  </div>
</div>

{#snippet outlinerFolderSettingsRow()}
  {@const isActive = activeRow?.kind === 'folder-settings'}
  <button
    type="button"
    class={`flex h-7 w-full cursor-pointer items-center rounded-sm px-3 text-sm text-left text-white ${
      isActive ? 'bg-accent' : 'hover:bg-muted/60'
    }`}
    aria-current={isActive ? 'true' : undefined}
    onclick={onSelectFolderSettings}
  >
    <span class="min-w-0 flex-1 truncate">Folder Settings</span>
  </button>
{/snippet}

{#snippet outlinerPromptRow({ row })}
  {@const isActive = activeRow?.kind === 'prompt' && activeRow.promptId === row.promptId}
  <button
    type="button"
    class={`flex h-7 w-full cursor-pointer items-center rounded-sm px-3 text-sm text-left text-white ${
      isActive ? 'bg-accent' : 'hover:bg-muted/60'
    }`}
    aria-current={isActive ? 'true' : undefined}
    onclick={() => onSelectPrompt(row.promptId)}
  >
    <span class="min-w-0 flex-1 truncate">{getPromptDisplayTitle(row.promptId)}</span>
  </button>
{/snippet}
