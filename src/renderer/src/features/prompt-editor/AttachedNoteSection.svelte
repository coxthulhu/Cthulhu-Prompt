<script lang="ts">
  import { onMount } from 'svelte'
  import { EyeOff, NotebookPen } from 'lucide-svelte'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import { createNoteEditorModelUri, type monaco } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import { noteEditorMeasuredHeight } from '@renderer/data/UiState/cache/NoteEditorUiCache.svelte.ts'
  import { mutatePacedNoteUpdate, flushNoteAutosaves } from '@renderer/data/Mutations/NoteMutations'
  import { AUTOSAVE_MS } from '@renderer/data/UiState/autosave/draftAutosave'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { ScrollToWithinWindowBand } from '@renderer/common/virtual-window/virtualWindowTypes'
  import MonacoEditorSection from './MonacoEditorSection.svelte'
  import PromptStatusIndicator from './PromptStatusIndicator.svelte'
  import { formatPromptModifiedRelative, formatPromptModifiedFull } from './promptModifiedTime'
  import { syncMonacoOverflowHost } from './monacoOverflowHost'
  import { ATTACHED_NOTE_HEADER_HEIGHT_PX, type AttachedNoteLayout } from './attachedNoteSizing'

  /** Note presentation and virtual-row services supplied by the owning editor. */
  let { attachment, widthPx, devicePixelRatio, rowId, hydrationPriority, shouldDehydrate,
    overlayRowElement, overflowPadding, scrollToWithinWindowBand, ontoggle, onInteraction, onEditorLifecycle }: {
    /** Authoritative note and its current visibility and measurements. */
    attachment: AttachedNoteLayout
    /** Card width used to key wrapped-height measurements. */
    widthPx: number
    /** Current display scaling used by the measurement cache. */
    devicePixelRatio: number
    /** Owning virtual row for cursor scrolling. */
    rowId: string
    /** Priority shared with the owning prompt editor. */
    hydrationPriority: number
    /** Releases Monaco while its virtual row is resizing. */
    shouldDehydrate: boolean
    /** Unclipped virtual-row overlay for Monaco popups. */
    overlayRowElement?: HTMLDivElement | null
    /** Positions popups at the note editor's origin. */
    overflowPadding: string
    /** Keeps the note caret within the collection viewport. */
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    /** Toggles persisted note visibility. */
    ontoggle: () => void
    /** Selects the owning prompt after a note edit. */
    onInteraction?: () => void
    /** Supplies note focus to the owning card's move shortcuts. */
    onEditorLifecycle: (editor: monaco.editor.IStandaloneCodeEditor, active: boolean) => void
  } = $props()
  /** Shared typography and note maximum from persisted system settings. */
  const settings = getSystemSettingsContext()
  /** A blank note starts at one visible line. */
  const sizingConfig = $derived({ fontSize: settings.promptFontSize, minLines: 1, maxLines: settings.attachedNoteMaxLines })
  /** Separate models prevent note edits from affecting prompt text. */
  const modelUri = $derived(createNoteEditorModelUri(attachment.note.id))
  /** Relative dates refresh while the section remains mounted. */
  let nowMs = $state(Date.now())
  /** Unclipped Monaco popup container. */
  let overflowHost = $state<HTMLDivElement | null>(null)
  /** Independently positioned wrapper for the note's popup origin. */
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  /** Retains the caret and internal scroll when hiding and revealing the note. */
  let viewStateJson = $state<string | null>(null)

  // Side effect: refresh the relative timestamp and release the note popup host on unmount.
  onMount(() => {
    /** Matches the prompt metadata's refresh cadence. */
    const interval = window.setInterval(() => { nowMs = Date.now() }, 60_000)
    return () => {
      window.clearInterval(interval)
      overflowPaddingHost?.remove()
    }
  })

  // Side effect: align the note's popup host without shifting the prompt's separate host.
  $effect(() => {
    /** Hidden notes release their popup DOM along with Monaco. */
    const next = syncMonacoOverflowHost({
      overlayRowElement: attachment.visible ? overlayRowElement : null,
      overflowHost, overflowPaddingHost, padding: overflowPadding
    })
    overflowHost = next.overflowHost
    overflowPaddingHost = next.overflowPaddingHost
    if (overflowPaddingHost) {
      overflowPaddingHost.style.position = 'absolute'
      overflowPaddingHost.style.inset = '0'
    }
  })
</script>

<!-- The collapsed header remains visible even though Monaco releases its resources. -->
<Separator />
<button
  type="button"
  class="attached-note-header"
  style={`height:${ATTACHED_NOTE_HEADER_HEIGHT_PX}px;`}
  data-hidden={!attachment.visible}
  data-testid="attached-note-header"
  aria-expanded={attachment.visible}
  aria-label={attachment.visible ? 'Hide attached note' : 'Show attached note'}
  onclick={ontoggle}
>
  {#if attachment.visible}
    <PromptStatusIndicator isEdited={attachment.isEdited} testId="attached-note-indicator" class="attached-note-indicator" />
  {/if}
  <IconCell icon={attachment.visible ? NotebookPen : EyeOff} variant="small" class="attached-note-icon" />
  <span class="attached-note-copy">
    <span class="attached-note-title text-sm leading-5">Attached Note</span>
    <span class="attached-note-metadata text-xs" data-testid="attached-note-metadata"
      title={attachment.visible ? formatPromptModifiedFull(attachment.note.modifiedAt) : undefined}>
      {attachment.visible ? `Updated ${formatPromptModifiedRelative(attachment.note.modifiedAt, nowMs)}` : 'Hidden'}
    </span>
  </span>
</button>
{#if attachment.visible}
  <Separator />
  <MonacoEditorSection
    class="attached-note-body"
    testId="attached-note-editor"
    initialValue={attachment.note.noteText}
    initialViewStateJson={viewStateJson}
    onViewStateCapture={(value) => { viewStateJson = value }}
    {modelUri}
    containerWidthPx={widthPx}
    placeholderHeightPx={attachment.editorHeightPx}
    overflowWidgetsDomNode={overflowHost}
    {sizingConfig}
    {hydrationPriority}
    {shouldDehydrate}
    {rowId}
    {scrollToWithinWindowBand}
    {onEditorLifecycle}
    findSectionKey="attached-note"
    onBlur={() => { void runIpcBestEffort(flushNoteAutosaves) }}
    onChange={(text, meta) => {
      /** Layout notifications must not mark or save unchanged note text. */
      const textChanged = text !== attachment.note.noteText
      noteEditorMeasuredHeight.record(`${attachment.note.id}:${sizingConfig.fontSize}`, {
        measuredHeightPx: meta.contentHeightPx, widthPx, devicePixelRatio
      }, textChanged)
      if (textChanged) {
        onInteraction?.()
        mutatePacedNoteUpdate({ noteId: attachment.note.id, noteText: text }, AUTOSAVE_MS)
      }
    }}
  />
{/if}

<style>
  .attached-note-header {
    align-items: center;
    background: var(--ui-card-normal-surface);
    border: 0;
    color: var(--ui-muted-text);
    cursor: pointer;
    display: flex;
    gap: 9px;
    min-width: 0;
    padding: 0 12px 0 21px;
    position: relative;
    text-align: left;
    width: 100%;
  }
  .attached-note-header :global(.attached-note-icon) {
    color: var(--ui-normal-text);
    flex: 0 0 auto;
  }
  .attached-note-copy {
    display: flex;
    align-items: baseline;
    gap: 12px;
    min-width: 0;
  }
  .attached-note-title {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
  }
  .attached-note-header[data-hidden='true'] :global(.attached-note-icon) {
    color: var(--ui-muted-icon-glyph);
  }
  .attached-note-header[data-hidden='true'] .attached-note-title {
    color: var(--ui-secondary-text);
    font-weight: var(--font-weight-normal);
  }
  .attached-note-header[data-hidden='true']:hover .attached-note-title,
  .attached-note-header[data-hidden='true']:focus-visible .attached-note-title {
    color: var(--ui-hoverable-text);
  }
  .attached-note-header[data-hidden='true']:hover :global(.attached-note-icon),
  .attached-note-header[data-hidden='true']:focus-visible :global(.attached-note-icon) {
    color: var(--ui-hoverable-icon-glyph);
  }
  .attached-note-metadata {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .attached-note-header :global(.attached-note-indicator) {
    inset: 0 auto 0 0;
    position: absolute;
    width: 2px;
  }
</style>
