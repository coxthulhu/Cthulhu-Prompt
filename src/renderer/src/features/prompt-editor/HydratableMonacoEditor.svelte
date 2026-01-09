<script lang="ts">
  import { onMount } from 'svelte'
  import { cn } from '@renderer/common/Cn'
  import AutoSizingMonacoEditor from './AutoSizingMonacoEditor.svelte'
  import MonacoEditorPlaceholder from './MonacoEditorPlaceholder.svelte'
  import {
    cancelMonacoHydration,
    enqueueMonacoHydration,
    updateMonacoHydrationPriority,
    type MonacoHydrationEntry
  } from './monacoHydrationQueue'

  type Props = {
    initialValue: string
    containerWidthPx: number
    placeholderHeightPx: number
    overflowWidgetsDomNode: HTMLElement
    hydrationPriority: number
    shouldDehydrate: boolean
    onHydrationChange?: (isHydrated: boolean) => void
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
    class?: string
  }

  let {
    initialValue,
    containerWidthPx,
    placeholderHeightPx,
    overflowWidgetsDomNode,
    hydrationPriority,
    shouldDehydrate,
    onHydrationChange,
    onChange,
    onBlur,
    class: className
  }: Props = $props()

  let isHydrated = $state(false)
  let queuedEntry: MonacoHydrationEntry | null = null

  // Side effect: ensure queued entries are cleaned up on unmount.
  onMount(() => {
    return () => {
      if (queuedEntry) {
        cancelMonacoHydration(queuedEntry)
      }
    }
  })

  // Side effect: manage hydration and report state for virtual window anchoring.
  $effect(() => {
    if (shouldDehydrate) {
      if (queuedEntry) {
        cancelMonacoHydration(queuedEntry)
        queuedEntry = null
      }
      if (isHydrated) {
        isHydrated = false
      }
      onHydrationChange?.(isHydrated)
      return
    }
    if (!queuedEntry && !isHydrated) {
      queuedEntry = enqueueMonacoHydration(hydrationPriority, () => {
        queuedEntry = null
        isHydrated = true
      })
    }
    onHydrationChange?.(isHydrated)
  })

  // Side effect: keep queued hydration priority aligned with scroll updates.
  $effect(() => {
    if (!queuedEntry) return
    if (shouldDehydrate) return
    updateMonacoHydrationPriority(queuedEntry, hydrationPriority)
  })

</script>

<div class={cn('border border-border rounded-md bg-[#1e1e1e] pl-3 py-1', className)}>
  {#if isHydrated}
    <AutoSizingMonacoEditor
      {initialValue}
      {containerWidthPx}
      {overflowWidgetsDomNode}
      {onChange}
      {onBlur}
    />
  {:else}
    <MonacoEditorPlaceholder heightPx={placeholderHeightPx} />
  {/if}
</div>
