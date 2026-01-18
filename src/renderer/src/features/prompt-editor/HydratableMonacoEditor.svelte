<script lang="ts">
  import { onMount } from 'svelte'
  import type { monaco } from '@renderer/common/Monaco'
  import { cn } from '@renderer/common/Cn'
  import AutoSizingMonacoEditor from './AutoSizingMonacoEditor.svelte'
  import MonacoEditorPlaceholder from './MonacoEditorPlaceholder.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import type { PromptFolderFindRequest } from '../prompt-folders/promptFolderFindTypes'
  import {
    cancelMonacoHydration,
    enqueueMonacoHydration,
    isMonacoHydrationQueuePaused,
    pauseMonacoHydrationForFrame,
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
    rowId: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onImmediateHydrationRequest?: (request: (() => void) | null) => void
    onHydrationChange?: (isHydrated: boolean) => void
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    findRequest?: PromptFolderFindRequest | null
    onFindMatches?: (query: string, count: number) => void
    onFindMatchReveal?: (
      handler: ((query: string, matchIndex: number) => number | null) | null
    ) => void
    class?: string
  }

  let {
    initialValue,
    containerWidthPx,
    placeholderHeightPx,
    overflowWidgetsDomNode,
    hydrationPriority,
    shouldDehydrate,
    rowId,
    scrollToWithinWindowBand,
    onImmediateHydrationRequest,
    onHydrationChange,
    onChange,
    onBlur,
    onEditorLifecycle,
    findRequest,
    onFindMatches,
    onFindMatchReveal,
    class: className
  }: Props = $props()

  let isHydrated = $state(false)
  let queuedEntry: MonacoHydrationEntry | null = null
  let lastReportedHydration = $state<boolean | null>(null)

  const reportHydrationIfChanged = () => {
    if (lastReportedHydration === isHydrated) return
    lastReportedHydration = isHydrated
    onHydrationChange?.(isHydrated)
  }

  const requestImmediateHydration = () => {
    if (shouldDehydrate || isHydrated) return
    if (isMonacoHydrationQueuePaused()) return
    if (queuedEntry) {
      cancelMonacoHydration(queuedEntry)
      queuedEntry = null
    }
    const resumeHydration = pauseMonacoHydrationForFrame()
    isHydrated = true
    reportHydrationIfChanged()
    resumeHydration()
  }

  // Side effect: expose immediate hydration and clean up queued entries on unmount.
  onMount(() => {
    onImmediateHydrationRequest?.(requestImmediateHydration)
    return () => {
      if (queuedEntry) {
        cancelMonacoHydration(queuedEntry)
      }
      onImmediateHydrationRequest?.(null)
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
      reportHydrationIfChanged()
      return
    }
    if (!queuedEntry && !isHydrated) {
      queuedEntry = enqueueMonacoHydration(hydrationPriority, () => {
        queuedEntry = null
        isHydrated = true
        reportHydrationIfChanged()
      })
    }
    reportHydrationIfChanged()
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
      {rowId}
      {scrollToWithinWindowBand}
      {onChange}
      {onBlur}
      {onEditorLifecycle}
      {findRequest}
      {onFindMatches}
      {onFindMatchReveal}
    />
  {:else}
    <MonacoEditorPlaceholder heightPx={placeholderHeightPx} />
  {/if}
</div>
