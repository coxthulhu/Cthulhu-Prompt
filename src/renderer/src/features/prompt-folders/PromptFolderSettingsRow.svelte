<script lang="ts">
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
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
    promptFolderId: string
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onHydrationChange?: (isHydrated: boolean) => void
    descriptionText: string
    onDescriptionChange: (text: string, measurement: TextMeasurement) => void
  }

  let {
    promptFolderId,
    rowId,
    virtualWindowWidthPx,
    devicePixelRatio,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    onHydrationChange,
    descriptionText,
    onDescriptionChange
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)

  const descriptionValue = $derived(descriptionText)
  const placeholderHeightPx = $derived(
    estimatePromptFolderSettingsMonacoHeight(descriptionValue, promptFontSize, promptEditorMinLines)
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
      {#if overflowHost}
        {#key promptFolderId}
          <HydratableMonacoEditor
            initialValue={descriptionValue}
            containerWidthPx={virtualWindowWidthPx}
            {placeholderHeightPx}
            overflowWidgetsDomNode={overflowHost}
            {hydrationPriority}
            {shouldDehydrate}
            {rowId}
            findSectionKey="folder-description"
            {scrollToWithinWindowBand}
            {onHydrationChange}
            onChange={(text, meta) => {
              onDescriptionChange(text, {
                measuredHeightPx: getPromptFolderSettingsHeightPx(meta.heightPx),
                widthPx: virtualWindowWidthPx,
                devicePixelRatio
              })
            }}
          />
        {/key}
      {:else}
        <MonacoEditorPlaceholder heightPx={placeholderHeightPx} />
      {/if}
    </div>
  </div>
</div>
