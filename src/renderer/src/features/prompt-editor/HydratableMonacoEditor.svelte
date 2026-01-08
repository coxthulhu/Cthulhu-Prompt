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
    hydrationPriority: number
    shouldDehydrate: boolean
    reportHydrationState?: (isHydrated: boolean) => void
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
    class?: string
  }

  let {
    initialValue,
    containerWidthPx,
    placeholderHeightPx,
    hydrationPriority,
    shouldDehydrate,
    reportHydrationState,
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

  // Side effect: dehydrate offscreen editors while width resizing is active.
  $effect(() => {
    if (shouldDehydrate) {
      if (queuedEntry) {
        cancelMonacoHydration(queuedEntry)
        queuedEntry = null
      }
      if (isHydrated) {
        isHydrated = false
      }
      return
    }
    if (!queuedEntry && !isHydrated) {
      queuedEntry = enqueueMonacoHydration(hydrationPriority, () => {
        queuedEntry = null
        isHydrated = true
      })
    }
  })

  // Side effect: keep queued hydration priority aligned with scroll updates.
  $effect(() => {
    if (!queuedEntry) return
    if (shouldDehydrate) return
    updateMonacoHydrationPriority(queuedEntry, hydrationPriority)
  })

  // Side effect: report hydration transitions for virtual window anchoring.
  $effect(() => {
    reportHydrationState?.(isHydrated)
  })
</script>

<div class={cn('border border-border rounded-md bg-[#1e1e1e] pl-3 py-1', className)}>
  {#if isHydrated}
    <AutoSizingMonacoEditor {initialValue} {containerWidthPx} {onChange} {onBlur} />
  {:else}
    <MonacoEditorPlaceholder heightPx={placeholderHeightPx} />
  {/if}
</div>
