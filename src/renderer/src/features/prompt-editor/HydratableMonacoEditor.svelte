<script lang="ts">
  import { onMount } from 'svelte'
  import type { monaco } from '@renderer/common/Monaco'
  import { cn } from '@renderer/common/Cn'
  import AutoSizingMonacoEditor from './AutoSizingMonacoEditor.svelte'
  import MonacoEditorPlaceholder from './MonacoEditorPlaceholder.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import type { PromptFolderFindRequest } from '../prompt-folders/find/promptFolderFindTypes'
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
    initialViewStateJson?: string | null
    viewStateCaptureKey?: string
    modelUri: monaco.Uri
    containerWidthPx: number
    placeholderHeightPx: number
    overflowWidgetsDomNode: HTMLElement
    hydrationPriority: number
    shouldDehydrate: boolean
    rowId: string
    minLines?: number
    maxLines?: number
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onImmediateHydrationRequest?: (request: (() => Promise<void>) | null) => void
    onHydrationChange?: (isHydrated: boolean) => void
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    findSectionKey: string
    findRequest?: PromptFolderFindRequest | null
    onFindMatches?: (query: string, count: number) => void
    onFindMatchReveal?: (
      handler: ((query: string, matchIndex: number) => number | null) | null
    ) => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
    onViewStateCapture?: (viewStateJson: string | null) => void
    class?: string
  }

  let {
    initialValue,
    initialViewStateJson,
    viewStateCaptureKey,
    modelUri,
    containerWidthPx,
    placeholderHeightPx,
    overflowWidgetsDomNode,
    hydrationPriority,
    shouldDehydrate,
    rowId,
    minLines,
    maxLines,
    scrollToWithinWindowBand,
    onImmediateHydrationRequest,
    onHydrationChange,
    onChange,
    onBlur,
    onEditorLifecycle,
    findSectionKey,
    findRequest,
    onFindMatches,
    onFindMatchReveal,
    onSelectionChange,
    onViewStateCapture,
    class: className
  }: Props = $props()

  let isHydrated = $state(false)
  let editorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  let queuedEntry: MonacoHydrationEntry | null = null
  let lastReportedHydration = $state<boolean | null>(null)
  let hydrationReadyPromise: Promise<void> | null = null
  let resolveHydrationReady: (() => void) | null = null

  const resolveEditorReady = () => {
    resolveHydrationReady?.()
    hydrationReadyPromise = null
    resolveHydrationReady = null
  }

  const waitForEditorReady = (): Promise<void> => {
    if (editorInstance) return Promise.resolve()
    hydrationReadyPromise ??= new Promise<void>((resolve) => {
      resolveHydrationReady = resolve
    })
    return hydrationReadyPromise
  }

  const handleEditorLifecycle = (
    editor: monaco.editor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      editorInstance = editor
      resolveEditorReady()
    } else if (editorInstance === editor) {
      editorInstance = null
    }
    reportHydration(isActive)
    onEditorLifecycle?.(editor, isActive)
  }

  const reportHydration = (nextIsHydrated: boolean) => {
    if (lastReportedHydration === nextIsHydrated) return
    lastReportedHydration = nextIsHydrated
    onHydrationChange?.(nextIsHydrated)
  }

  const handleFrameClick = (event: MouseEvent) => {
    // Focus only direct frame clicks so Monaco keeps its existing cursor and selection behavior.
    if (event.target !== event.currentTarget) return
    editorInstance?.focus()
  }

  const requestImmediateHydration = async (): Promise<void> => {
    if (shouldDehydrate) return
    if (isMonacoHydrationQueuePaused()) return
    if (!isHydrated) {
      if (queuedEntry) {
        cancelMonacoHydration(queuedEntry)
        queuedEntry = null
      }
      const resumeHydration = pauseMonacoHydrationForFrame()
      isHydrated = true
      resumeHydration()
    }
    await waitForEditorReady()
  }

  // Side effect: expose immediate hydration and clean up queued entries on unmount.
  onMount(() => {
    onImmediateHydrationRequest?.(requestImmediateHydration)
    return () => {
      if (queuedEntry) {
        cancelMonacoHydration(queuedEntry)
      }
      resolveEditorReady()
      reportHydration(false)
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
      reportHydration(false)
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
</script>

<div
  class={cn('border border-border rounded-md bg-[#1e1e1e] pl-3 py-1', className)}
  role="presentation"
  onclick={handleFrameClick}
>
  {#if isHydrated}
    <AutoSizingMonacoEditor
      {initialValue}
      {initialViewStateJson}
      {viewStateCaptureKey}
      {modelUri}
      {containerWidthPx}
      {overflowWidgetsDomNode}
      {rowId}
      {minLines}
      {maxLines}
      {scrollToWithinWindowBand}
      {onChange}
      {onBlur}
      onEditorLifecycle={handleEditorLifecycle}
      {findSectionKey}
      {findRequest}
      {onFindMatches}
      {onFindMatchReveal}
      {onSelectionChange}
      {onViewStateCapture}
    />
  {:else}
    <MonacoEditorPlaceholder heightPx={placeholderHeightPx} {minLines} {maxLines} />
  {/if}
</div>
