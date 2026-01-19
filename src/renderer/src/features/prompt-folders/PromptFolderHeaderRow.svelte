<script lang="ts">
  import type { PromptFolder } from '@shared/ipc'
  import type { PromptFolderData } from '@renderer/data/PromptFolderDataStore.svelte.ts'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import {
    HEADER_EDITOR_LEFT_OFFSET_PX,
    HEADER_EDITOR_TOP_OFFSET_PX,
    estimatePromptFolderDescriptionMonacoHeight,
    getPromptFolderHeaderHeightPx
  } from './promptFolderDescriptionSizing'

  type Props = {
    folder: PromptFolder
    promptCount: number
    isLoading: boolean
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    onHydrationChange?: (isHydrated: boolean) => void
    folderData: PromptFolderData
  }

  let {
    folder,
    promptCount,
    isLoading,
    rowId,
    virtualWindowWidthPx,
    devicePixelRatio,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    onHydrationChange,
    folderData
  }: Props = $props()

  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)

  const descriptionValue = $derived(folderData.descriptionDraft.text)
  const placeholderHeightPx = $derived(estimatePromptFolderDescriptionMonacoHeight(descriptionValue))

  // Side effect: align Monaco overflow widgets with the description editor inside the virtualized row.
  $effect(() => {
    const next = syncMonacoOverflowHost({
      overlayRowElement,
      overflowHost,
      overflowPaddingHost,
      padding: `${HEADER_EDITOR_TOP_OFFSET_PX}px 0 0 ${HEADER_EDITOR_LEFT_OFFSET_PX}px`
    })
    overflowPaddingHost = next.overflowPaddingHost
    overflowHost = next.overflowHost
  })
</script>

<div class="pt-6">
  <h1 class="text-2xl font-bold">{folder.displayName}</h1>
  <div class="mt-4">
    <p class="text-sm font-semibold text-muted-foreground">Folder Description</p>
    <div class="mt-2">
      {#if overflowHost && !isLoading}
        <HydratableMonacoEditor
          initialValue={descriptionValue}
          containerWidthPx={virtualWindowWidthPx}
          placeholderHeightPx={placeholderHeightPx}
          overflowWidgetsDomNode={overflowHost}
          {hydrationPriority}
          {shouldDehydrate}
          {rowId}
          {onHydrationChange}
          onChange={(text, meta) => {
            folderData.setDescriptionText(text, {
              measuredHeightPx: getPromptFolderHeaderHeightPx(meta.heightPx),
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
  <h2 class="mt-6 text-lg font-semibold mb-4">
    Prompts ({isLoading ? 0 : promptCount})
  </h2>
</div>
