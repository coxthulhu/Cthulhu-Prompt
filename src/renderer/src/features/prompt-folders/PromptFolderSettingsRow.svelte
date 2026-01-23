<script lang="ts">
  import type { PromptFolderData } from '@renderer/data/PromptFolderDataStore.svelte.ts'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import {
    SETTINGS_EDITOR_LEFT_OFFSET_PX,
    SETTINGS_EDITOR_TOP_OFFSET_PX,
    estimatePromptFolderSettingsMonacoHeight,
    getPromptFolderSettingsHeightPx
  } from './promptFolderSettingsSizing'

  type Props = {
    isLoading: boolean
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onHydrationChange?: (isHydrated: boolean) => void
    folderData: PromptFolderData
  }

  let {
    isLoading,
    rowId,
    virtualWindowWidthPx,
    devicePixelRatio,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    onHydrationChange,
    folderData
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)

  const descriptionValue = $derived(folderData.descriptionDraft.text)
  const placeholderHeightPx = $derived(
    estimatePromptFolderSettingsMonacoHeight(descriptionValue, promptFontSize)
  )

  // Side effect: align Monaco overflow widgets with the description editor inside the virtualized row.
  $effect(() => {
    const next = syncMonacoOverflowHost({
      overlayRowElement,
      overflowHost,
      overflowPaddingHost,
      padding: `${SETTINGS_EDITOR_TOP_OFFSET_PX}px 0 0 ${SETTINGS_EDITOR_LEFT_OFFSET_PX}px`
    })
    overflowPaddingHost = next.overflowPaddingHost
    overflowHost = next.overflowHost
  })
</script>

<div class="pt-6" data-virtual-window-row>
  <div>
    <h2 class="text-lg font-semibold">Folder Settings</h2>
    <p class="mt-2 text-sm font-semibold text-muted-foreground">Folder Description</p>
    <div class="mt-2">
      {#if overflowHost && !isLoading}
        <HydratableMonacoEditor
          initialValue={descriptionValue}
          containerWidthPx={virtualWindowWidthPx}
          {placeholderHeightPx}
          overflowWidgetsDomNode={overflowHost}
          {hydrationPriority}
          {shouldDehydrate}
          {rowId}
          {scrollToWithinWindowBand}
          {onHydrationChange}
          onChange={(text, meta) => {
            folderData.setDescriptionText(text, {
              measuredHeightPx: getPromptFolderSettingsHeightPx(meta.heightPx),
              widthPx: virtualWindowWidthPx,
              devicePixelRatio
            })
          }}
        />
      {:else}
        <MonacoEditorPlaceholder heightPx={placeholderHeightPx} />
      {/if}
    </div>
  </div>
</div>
