<script lang="ts">
  import { onMount, tick } from 'svelte'
  import AttachedNoteButton from './AttachedNoteButton.svelte'
  import AttachedNoteSection from './AttachedNoteSection.svelte'
  import { ATTACHED_NOTE_HEADER_HEIGHT_PX, getAttachedNoteSectionHeight, getPromptSizingWithNote, type AttachedNoteLayout } from './attachedNoteSizing'
  import { createAttachedNote, setAttachedNoteVisible } from '@renderer/data/Mutations/NoteMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { compactGuid } from '@shared/utilities/compactGuid'
  import { registerKeyboardScope } from '@renderer/common/keyboardRouter'
  import { Check, Layers, Plus } from 'lucide-svelte'
  import { createPromptEditorModelUri, monaco } from '@renderer/common/Monaco'
  import { PROMPT_STATUS_FOLDER_REGISTRY, PromptStatus, type PromptContentStatus } from '@shared/domain/prompt/Prompt'
  import type { TextMeasurement } from '@renderer/data/UiState/cache/measuredHeightCache'
  import type { PromptHandleDropPayload } from '@renderer/features/prompt-drag-drop/promptHandleDrag'
  import { promptEntryDragState } from '@renderer/features/prompt-drag-drop/promptEntryDragState.svelte.ts'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import ToolbarButton from '@renderer/common/cthulhu-ui/buttons/ToolbarButton.svelte'
  import EditorCardSurface from './EditorCardSurface.svelte'
  import EditorSubtitleBar from './EditorSubtitleBar.svelte'
  import PromptEditorSidebar from './PromptEditorSidebar.svelte'
  import PromptEditorTitleArea from './PromptEditorTitleArea.svelte'
  import MonacoEditorSection from './MonacoEditorSection.svelte'
  import { syncMonacoOverflowHost } from './monacoOverflowHost'
  import type { ScrollToWithinWindowBand } from '@renderer/common/virtual-window/virtualWindowTypes'
  import { getPromptDisplayTitle as getPromptTitleText } from '@shared/domain/prompt/promptFallbackTitle'
  import {
    lookupMarkdownContentEditorViewStateJson,
    setMarkdownContentEditorViewStateJson
  } from '@renderer/data/UiState/autosave/MarkdownContentUiStateAutosave.svelte.ts'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { getPromptCollectionFindContext } from '../prompt-collections/find/promptCollectionFindContext'
  import type {
    PromptCollectionFindRequest,
    PromptCollectionFindRowHandle,
    PromptCollectionFindSelection
  } from '../prompt-collections/find/promptCollectionFindTypes'
  import {
    PROMPT_COLLECTION_FIND_BODY_SECTION_KEY,
    PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY
  } from '../prompt-collections/find/promptCollectionFindSectionKeys'
  import {
    clampMonacoHeightPx,
    EDITOR_SUBTITLE_BAR_HEIGHT_PX,
    getMonacoHeightFromRowPx,
    getPromptEditorTitleAreaHeightPx,
    getPromptEditorTitleAreaWidthPx,
    getRowHeightPx,
    isPromptEditorCompactLayout,
    MONACO_PADDING_PX,
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
    PROMPT_EDITOR_BODY_PADDING_LEFT_PX,
    PROMPT_EDITOR_BODY_PADDING_RIGHT_PX,
    PROMPT_EDITOR_BODY_PADDING_TOP_PX,
    PROMPT_EDITOR_SEPARATOR_HEIGHT_PX,
    PROMPT_EDITOR_SIDEBAR_WIDTH_PX,
    type PromptEditorSizingConfig
  } from './promptEditorSizing'
  import { getPromptTokenCount } from './promptEditorCounts'
  import { PromptCollectionScreenMode } from '../prompt-collections/promptCollectionScreenMode'
  import { PROMPT_TEXT_TEMPLATE_PARAMETER } from './promptTemplateParameters'
  import { applyPromptTemplates } from './promptTemplatingEngine'

  // Shared editor implementation; prompt and template wrappers provide the variant behavior.
  let {
    promptId,
    attachment,
    promptCollectionId,
    screenCollectionId,
    workspaceId,
    promptDraftRecord,
    contentKind = 'prompt',
    contentLabel = 'prompt',
    metadataTemplateLabel = 'Template',
    metadataTemplateState = 'not-selected',
    modelUri = createPromptEditorModelUri(promptId),
    compactLayoutMaxWidthPx,
    rowId,
    virtualWindowWidthPx,
    rowContentLeftOffsetPx = 0,
    devicePixelRatio,
    rowHeightPx: virtualRowHeightPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    onHydrationChange,
    copyTemplateTexts = [],
    onTitleChange,
    onTextChange,
    onInteraction,
    onTemplateSelect,
    onTemplateSelectAndCopy,
    onCopySuccess,
    onBeforeCopy,
    copyLabel,
    copyTitle,
    deleteLabel,
    deleteDialogTitle,
    deleteDialogDescription,
    screenMode = PromptCollectionScreenMode.Active,
    status = PromptStatus.Todo,
    finalizedAt = null,
    scrollToWithinWindowBand,
    isFirstPrompt,
    isLastPrompt,
    isDragEnabled = true,
    onEditorLifecycle,
    onDelete,
    onArchive,
    onRestore,
    onStatusChange,
    onMoveUp,
    onMoveDown,
    onPromptTreeDrop
  }: {
    promptId: string
    /** Optional note presentation shared with the virtual row's height calculation. */
    attachment?: AttachedNoteLayout
    promptCollectionId: string
    screenCollectionId: string
    workspaceId: string | null
    promptDraftRecord: {
      title: string
      fallbackTitle: string
      modifiedAt: string
      text: string
      templateName?: string
      templateState?: 'not-selected' | 'no-template' | 'selected'
      isEdited: boolean
    }
    contentKind?: import('@shared/domain/prompt-collection/PromptCollection').PromptCollectionContentKind
    contentLabel?: string
    metadataTemplateLabel?: string | null
    metadataTemplateState?: 'not-selected' | 'no-template' | 'selected'
    modelUri?: monaco.Uri
    compactLayoutMaxWidthPx?: number
    rowId: string
    virtualWindowWidthPx: number
    rowContentLeftOffsetPx?: number
    devicePixelRatio: number
    rowHeightPx: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    onHydrationChange?: (isHydrated: boolean) => void
    copyTemplateTexts?: readonly string[]
    onTitleChange: (title: string) => void
    onTextChange: (text: string, measurement: TextMeasurement) => void
    /** Selects this editor after a content change or explicit control activation. */
    onInteraction?: () => void
    onTemplateSelect?: () => void
    onTemplateSelectAndCopy?: () => void
    onCopySuccess?: () => void | Promise<void>
    /** Confirms prompt workflow changes before copying. */
    onBeforeCopy?: () => Promise<boolean>
    copyLabel?: string
    copyTitle?: string
    deleteLabel?: string
    deleteDialogTitle?: string
    deleteDialogDescription?: string
    screenMode?: PromptCollectionScreenMode
    status?: PromptContentStatus
    finalizedAt?: string | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    isFirstPrompt: boolean
    isLastPrompt: boolean
    isDragEnabled?: boolean
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    onDelete: () => void
    /** Archives this prompt without opening the delete confirmation dialog. */
    onArchive?: () => void
    /** Restores an archived template to the top of Active. */
    onRestore?: () => void
    onStatusChange?: (status: PromptStatus) => void
    onMoveUp: () => Promise<boolean>
    onMoveDown: () => Promise<boolean>
    onPromptTreeDrop: (dropPayload: PromptHandleDropPayload | null) => void | Promise<void>
  } = $props()
  const systemSettings = getSystemSettingsContext()
  const promptNavigation = getPromptNavigationContext()
  const promptEditorSizingConfig: PromptEditorSizingConfig = $derived(getPromptSizingWithNote({
    fontSize: systemSettings.promptFontSize,
    minLines: systemSettings.promptEditorMinLines,
    maxLines: systemSettings.promptEditorMaxLines
  }, attachment))
  /** Includes collapsed note chrome and the expanded editor's displayed height. */
  const noteSectionHeightPx = $derived(getAttachedNoteSectionHeight(attachment))
  /** Whether this editor belongs to an automatically ordered final-status screen. */
  // Finalized groups do not allow manual ordering.
  const isFinalMode = $derived(PROMPT_STATUS_FOLDER_REGISTRY[screenMode].ordering === 'finalizedAt')
  /** Prompt-card sidebar width retained in active and final-status modes. */
  const sidebarWidthPx = PROMPT_EDITOR_SIDEBAR_WIDTH_PX
  const titleAreaWidthPx = $derived(
    getPromptEditorTitleAreaWidthPx(virtualWindowWidthPx, true)
  )
  const titleAreaHeightPx = $derived(
    getPromptEditorTitleAreaHeightPx(titleAreaWidthPx, compactLayoutMaxWidthPx)
  )
  const compactTitleLayout = $derived(
    isPromptEditorCompactLayout(titleAreaWidthPx, compactLayoutMaxWidthPx)
  )
  // Derive the template-only parameter bar height for rendering and virtual-row sizing.
  const subtitleBarHeightPx = $derived(
    contentKind === 'template' ? EDITOR_SUBTITLE_BAR_HEIGHT_PX : 0
  )
  const initialEditorViewStateJson = $derived(
    lookupMarkdownContentEditorViewStateJson(workspaceId, promptId)
  )
  // Derived content state and sizing so the row updates with virtual window changes.
  const promptData = $derived.by(() => {
    return {
      modifiedAt: promptDraftRecord.modifiedAt,
      fallbackTitle: promptDraftRecord.fallbackTitle,
      setTitle: onTitleChange,
      setText: onTextChange,
      draft: {
        title: promptDraftRecord.title,
        text: promptDraftRecord.text
      }
    }
  })
  const placeholderMonacoHeightPx = $derived.by(() => {
    return clampMonacoHeightPx(
      getMonacoHeightFromRowPx(
        virtualRowHeightPx - noteSectionHeightPx,
        titleAreaWidthPx,
        compactLayoutMaxWidthPx,
        subtitleBarHeightPx
      ),
      promptEditorSizingConfig
    )
  })
  const tokenCount = $derived(getPromptTokenCount(promptData.draft.text))
  // Derive configured state from the exact built-in token, regardless of occurrence count.
  const isPromptTextParameterConfigured = $derived(
    promptData.draft.text.includes(PROMPT_TEXT_TEMPLATE_PARAMETER.token)
  )
  const promptTreeTitle = $derived(getPromptTitleText(promptDraftRecord))
  const copyText = $derived(applyPromptTemplates(promptData.draft.text, copyTemplateTexts))
  // Track shared tree-entry drag state so both prompt drag entry points dim this row.
  const isDragging = $derived.by(() => {
    const draggedEntry = promptEntryDragState.draggedEntry
    return (
      draggedEntry?.kind === 'content' &&
      draggedEntry.location.promptCollectionId === promptCollectionId &&
      draggedEntry.contentId === promptId
    )
  })
  const getInitialMonacoHeightPx = () => placeholderMonacoHeightPx
  let monacoHeightPx = $state<number>(getInitialMonacoHeightPx())
  let rowElement = $state<HTMLDivElement | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  let titleInputRef = $state<HTMLInputElement | null>(null)
  let editorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  /** Separate focus target for shortcuts issued inside the note. */
  let noteEditorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  /** Only a newly added note requests automatic editor focus. */
  let focusNewNoteId = $state<string | null>(null)

  /** Adds and reveals a new note, or toggles an existing note without moving focus. */
  const toggleAttachedNote = (): void => {
    onInteraction?.()
    void runIpcBestEffort(async () => {
      if (attachment) {
        await setAttachedNoteVisible(workspaceId!, attachment.note.id, !attachment.visible)
      } else {
        /** Set focus intent before optimistic creation can mount the visible editor. */
        const noteId = compactGuid(window.crypto.randomUUID())
        focusNewNoteId = noteId
        try {
          await createAttachedNote(contentKind, promptId, noteId)
        } catch (error) {
          if (focusNewNoteId === noteId) focusNewNoteId = null
          throw error
        }
      }
    })
  }

  /** Tracks note focus independently and fulfills only the Add Note focus request. */
  const handleNoteEditorLifecycle = (editor: monaco.editor.IStandaloneCodeEditor, active: boolean): void => {
    noteEditorInstance = active ? editor : null
    if (active && focusNewNoteId === attachment?.note.id) {
      focusNewNoteId = null
      editor.focus()
    }
  }
  let isHydrated = $state(false)
  type FindRowHandlers = {
    requestImmediateHydration: (() => Promise<void>) | null
    revealSectionMatch: ((query: string, matchIndex: number) => number | null) | null
  }
  let findRowHandlers = $state<FindRowHandlers>({
    requestImmediateHydration: null,
    revealSectionMatch: null
  })
  const findContext = getPromptCollectionFindContext()

  const MONACO_VERTICAL_PADDING_PX = MONACO_PADDING_PX / 2

  const OVERFLOW_TOP_PADDING_PX = $derived(
    titleAreaHeightPx +
      PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
      subtitleBarHeightPx +
      (subtitleBarHeightPx > 0 ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX : 0) +
      PROMPT_EDITOR_BODY_PADDING_TOP_PX +
      MONACO_VERTICAL_PADDING_PX
  )
  const OVERFLOW_LEFT_PADDING_PX = $derived(
    rowContentLeftOffsetPx + sidebarWidthPx + PROMPT_EDITOR_BODY_PADDING_LEFT_PX
  )
  const OVERFLOW_RIGHT_PADDING_PX = PROMPT_EDITOR_BODY_PADDING_RIGHT_PX
  const OVERFLOW_BOTTOM_PADDING_PX =
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX + MONACO_VERTICAL_PADDING_PX

  // Side effect: keep the Monaco overflow host aligned with the prompt editor chrome.
  $effect(() => {
    const next = syncMonacoOverflowHost({
      overlayRowElement,
      overflowHost,
      overflowPaddingHost,
      padding: `${OVERFLOW_TOP_PADDING_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${OVERFLOW_LEFT_PADDING_PX}px`
    })
    overflowPaddingHost = next.overflowPaddingHost
    overflowHost = next.overflowHost
  })

  // Side effect: keep row height aligned with placeholder sizing while the editor is not hydrated.
  $effect(() => {
    if (isHydrated) return
    monacoHeightPx = placeholderMonacoHeightPx
  })

  const handleHydrationChange = (nextIsHydrated: boolean) => {
    isHydrated = nextIsHydrated
    onHydrationChange?.(nextIsHydrated)
  }

  const findRequest = $derived.by<PromptCollectionFindRequest | null>(() => {
    if (!findContext) return null
    const activeMatch =
      findContext.currentMatch?.entityId === promptId ? findContext.currentMatch : null

    return {
      isOpen: findContext.isFindOpen,
      query: findContext.query,
      activeSectionKey: activeMatch?.sectionKey ?? null,
      activeSectionMatchIndex: activeMatch?.sectionMatchIndex ?? null,
      shouldSelectActiveMatch: findContext.shouldSelectCurrentMatch
    }
  })

  const handleTitleChange = (title: string) => {
    if (title !== promptData.draft.title) onInteraction?.()
    promptData.setTitle(title)
    const startOffset = titleInputRef?.selectionStart ?? null
    const endOffset = titleInputRef?.selectionEnd ?? null
    findContext?.reportSectionTextChange(
      promptId,
      PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY,
      title,
      startOffset == null || endOffset == null
        ? null
        : {
            startOffset,
            endOffset,
            cursorOffset: titleInputRef?.selectionDirection === 'backward' ? startOffset : endOffset
          }
    )
  }

  const handleEditorLifecycle = (
    editor: monaco.editor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      editorInstance = editor
    } else if (editorInstance === editor) {
      editorInstance = null
    }
    onEditorLifecycle?.(editor, isActive)
  }

  /** Retains title selection direction for subsequent query edits. */
  const reportTitleSelection = (selection: PromptCollectionFindSelection) => {
    findContext?.reportSelection({
      entityId: promptId,
      sectionKey: PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY,
      ...selection
    })
  }

  /** Retains Monaco's active caret independently of the selected range. */
  const reportBodySelection = (selection: PromptCollectionFindSelection) => {
    findContext?.reportSelection({
      entityId: promptId,
      sectionKey: PROMPT_COLLECTION_FIND_BODY_SECTION_KEY,
      ...selection
    })
  }

  const getTitleCenterOffset = () => {
    const input = titleInputRef
    if (!input) return null
    const rowElement = input.closest('[data-virtual-window-row]') as HTMLElement | null
    if (!rowElement) return null
    const inputRect = input.getBoundingClientRect()
    const rowRect = rowElement.getBoundingClientRect()
    return inputRect.top - rowRect.top + inputRect.height / 2
  }

  const ensureHydrated = async (): Promise<boolean> => {
    if (isHydrated) return true
    // Side effect: wait for immediate hydration to mount and activate Monaco.
    await findRowHandlers.requestImmediateHydration?.()
    return isHydrated
  }

  const handlePromptTextParameterClick = async () => {
    onInteraction?.()
    if (!editorInstance) {
      await ensureHydrated()
      // Side effect: wait for Monaco lifecycle registration before editing or restoring focus.
      await tick()
    }

    const editor = editorInstance
    if (!editor) return

    if (!isPromptTextParameterConfigured) {
      const selections = editor.getSelections()
      if (selections && selections.length > 1) {
        editor.focus()
        return
      }

      editor.executeEdits('insert-prompt-text-template-parameter', [
        {
          range: selections?.[0] ?? new monaco.Selection(1, 1, 1, 1),
          text: PROMPT_TEXT_TEMPLATE_PARAMETER.token
        }
      ])
    }

    editor.focus()
  }

  const focusEditorFromTitle = async () => {
    if (!editorInstance) {
      await ensureHydrated()
    }

    // Side effect: wait for Monaco lifecycle registration before moving keyboard focus.
    await tick()
    editorInstance?.focus()
  }

  /** Returns keyboard focus from Monaco to this row's title without changing its selection. */
  const focusTitleFromEditorStart = () => {
    titleInputRef?.focus({ preventScroll: true })
  }

  // Side effect: register this row with the find integration for navigation.
  onMount(() => {
    if (!findContext) return
    const handle: PromptCollectionFindRowHandle = {
      entityId: promptId,
      rowId,
      isSectionReady: (sectionKey) =>
        sectionKey === PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY
          ? titleInputRef !== null
          : sectionKey === PROMPT_COLLECTION_FIND_BODY_SECTION_KEY &&
            editorInstance !== null &&
            findRowHandlers.revealSectionMatch !== null,
      revealSectionMatch: (sectionKey, query, matchIndex) => {
        if (sectionKey !== PROMPT_COLLECTION_FIND_BODY_SECTION_KEY) return null
        return findRowHandlers.revealSectionMatch?.(query, matchIndex) ?? null
      },
      getSectionCenterOffset: (sectionKey) =>
        sectionKey === PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY ? getTitleCenterOffset() : null
    }
    return findContext.registerRow(handle)
  })

  // Side effect: focus a navigated match or restore its selection when Find closes.
  $effect(() => {
    if (!findContext) return
    const request = findContext.focusRequests.pending
    if (!request) return
    const focusTarget = request.payload
    if (focusTarget.entityId !== promptId) return

    if (focusTarget.sectionKey === PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY) {
      const input = titleInputRef
      if (!input) return
      findContext.focusRequests.consume(request, ({ selection }) => {
        input.focus({ preventScroll: true })
        if (!selection) return
        input.setSelectionRange(selection.startOffset, selection.endOffset)
      })
      return
    }

    if (focusTarget.sectionKey !== PROMPT_COLLECTION_FIND_BODY_SECTION_KEY) return
    if (!editorInstance) return
    findContext.focusRequests.consume(request, ({ selection }) => {
      const editor = editorInstance!
      const model = editor.getModel()
      if (selection && model) {
        const start = model.getPositionAt(selection.startOffset)
        const end = model.getPositionAt(selection.endOffset)
        editor.setSelection({
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        })
      }
      editor.focus()
    })
  })

  // Side effect: reveal newly created prompts/templates and focus the preferred field once hydrated.
  $effect(() => {
    const request = promptNavigation.promptFocusRequests.pending
    if (
      !request ||
      request.payload.screenCollectionId !== screenCollectionId ||
      request.payload.promptId !== promptId
    ) {
      return
    }
    if (!isHydrated || !editorInstance) return

    promptNavigation.promptFocusRequests.consume(request, () => {
      if (scrollToWithinWindowBand && rowElement) {
        const viewport = rowElement.closest(
          '[data-testid="prompt-collection-virtual-window"]'
        ) as HTMLElement | null
        if (viewport) {
          const rowRect = rowElement.getBoundingClientRect()
          const viewportRect = viewport.getBoundingClientRect()
          const distanceFromViewport = (edgePx: number) => {
            if (edgePx < viewportRect.top) return viewportRect.top - edgePx
            if (edgePx > viewportRect.bottom) return edgePx - viewportRect.bottom
            return 0
          }
          const topDistance = distanceFromViewport(rowRect.top)
          const bottomDistance = distanceFromViewport(rowRect.bottom)
          const offsetPx = topDistance >= bottomDistance ? 0 : rowRect.height
          scrollToWithinWindowBand(rowId, offsetPx, 'minimal')
        }
      }

      if (systemSettings.newPromptFocus === 'title') {
        titleInputRef!.focus({ preventScroll: true })
      } else {
        editorInstance!.focus()
      }
    })
  })

  /** Keeps the current editing field focused after the optimistic row reorder. */
  const handleMoveShortcut = async (event: KeyboardEvent): Promise<void> => {
    /** Direction uses the existing placement limits. */
    const moveUp = event.key === 'ArrowUp'
    if (isFinalMode || (moveUp ? isFirstPrompt : isLastPrompt)) return
    /** Title focus is retained independently of Monaco's current selection. */
    const wasTitleFocused = event.target === titleInputRef
    /** Preserve the note's own caret and selection when its owner is moved. */
    const focusedEditor = noteEditorInstance?.hasTextFocus() ? noteEditorInstance : editorInstance
    onInteraction?.()
    void (moveUp ? onMoveUp() : onMoveDown())
    // Side effect: restore focus after Svelte moves the keyed row's DOM nodes.
    await tick()
    if (wasTitleFocused) titleInputRef?.focus({ preventScroll: true })
    else focusedEditor?.focus()
  }

  // Side effect: register this mounted editor's shortcuts and release them on unmount.
  onMount(() => registerKeyboardScope({
    layer: 'screen',
    bindings: [{
      matches: (event) =>
        event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
        (event.target === titleInputRef || editorInstance?.hasTextFocus() === true || noteEditorInstance?.hasTextFocus() === true),
      run: (event) => { void handleMoveShortcut(event) }
    }]
  }))
</script>

<EditorCardSurface
  bind:rowElement
  showSidebar
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px;`}
  data-testid={`prompt-editor-${promptId}`}
  data-dragging={isDragging ? 'true' : 'false'}
  data-virtual-window-row=""
>
  {#snippet sidebar()}
    <PromptEditorSidebar
      {promptId}
      {promptCollectionId}
      {contentKind}
      {contentLabel}
      title={promptTreeTitle}
      {isDragEnabled}
      {onPromptTreeDrop}
    />
  {/snippet}

  <PromptEditorTitleArea
    {findRequest}
    title={promptData.draft.title}
    draftText={promptData.draft.text}
    {copyText}
    modifiedAt={promptData.modifiedAt}
    {finalizedAt}
    fallbackTitle={promptData.fallbackTitle}
    {tokenCount}
    onTitleChange={handleTitleChange}
    onToolbarInteraction={onInteraction}
    onSelectionChange={reportTitleSelection}
    onTitleEditorFocus={focusEditorFromTitle}
    bind:inputRef={titleInputRef}
    {rowId}
    {scrollToWithinWindowBand}
    {onDelete}
    {onArchive}
    {onRestore}
    {onTemplateSelect}
    {onTemplateSelectAndCopy}
    {onCopySuccess}
    {onBeforeCopy}
    {onStatusChange}
    {metadataTemplateLabel}
    {metadataTemplateState}
    {copyLabel}
    {copyTitle}
    {deleteLabel}
    {deleteDialogTitle}
    {deleteDialogDescription}
    {status}
    isEdited={promptDraftRecord.isEdited}
    {titleAreaHeightPx}
    compactLayout={compactTitleLayout}
  >
    {#snippet attachedNoteAction()}
      <AttachedNoteButton noteId={attachment?.note.id} visible={attachment?.visible ?? false} ontoggle={toggleAttachedNote} />
    {/snippet}
  </PromptEditorTitleArea>

  <Separator />

  {#if contentKind === 'template'}
    <EditorSubtitleBar
      icon={Layers}
      title="Template Parameters"
      configuredCount={isPromptTextParameterConfigured ? 1 : 0}
      totalCount={1}
      actionsLabel="Template parameters"
      testId="prompt-template-parameters-toolbar"
    >
      {#snippet actions()}
        <ToolbarButton
          icon={Plus}
          pressedIcon={Check}
          text={PROMPT_TEXT_TEMPLATE_PARAMETER.name}
          pressed={isPromptTextParameterConfigured}
          title={isPromptTextParameterConfigured
            ? 'Prompt text configured'
            : 'Add prompt text'}
          testId="prompt-template-parameter-prompt-text"
          onclick={handlePromptTextParameterClick}
        />
      {/snippet}
    </EditorSubtitleBar>

    <Separator />
  {/if}

  {#key promptId}
    <MonacoEditorSection
      class="prompt-editor-body-editor-section"
      initialValue={promptData.draft.text}
      initialViewStateJson={initialEditorViewStateJson}
      viewStateCaptureKey={`content:${promptId}`}
      {modelUri}
      containerWidthPx={virtualWindowWidthPx}
      placeholderHeightPx={placeholderMonacoHeightPx}
      overflowWidgetsDomNode={overflowHost}
      sizingConfig={promptEditorSizingConfig}
      {hydrationPriority}
      {shouldDehydrate}
      {rowId}
      {scrollToWithinWindowBand}
      onEditorLifecycle={handleEditorLifecycle}
      findSectionKey={PROMPT_COLLECTION_FIND_BODY_SECTION_KEY}
      {findRequest}
      onFindMatchReveal={(handler) => {
        findRowHandlers.revealSectionMatch = handler
      }}
      onSelectionChange={reportBodySelection}
      onBackwardTabAtStart={focusTitleFromEditorStart}
      onImmediateHydrationRequest={(request) => {
        findRowHandlers.requestImmediateHydration = request
      }}
      onViewStateCapture={(viewStateJson) => {
        if (!workspaceId) return
        setMarkdownContentEditorViewStateJson(workspaceId, promptId, viewStateJson)
      }}
      onHydrationChange={handleHydrationChange}
      onChange={(text, meta) => {
        // Monaco also reports hydration and size changes with unchanged content.
        if (text !== promptData.draft.text) onInteraction?.()
        if (meta.heightPx !== monacoHeightPx) {
          monacoHeightPx = meta.heightPx
        }
        promptData.setText(text, {
          measuredHeightPx: getRowHeightPx(
            meta.heightPx,
            titleAreaWidthPx,
            compactLayoutMaxWidthPx,
            subtitleBarHeightPx
          ),
          widthPx: virtualWindowWidthPx,
          devicePixelRatio
        })
        findContext?.reportSectionTextChange(
          promptId,
          PROMPT_COLLECTION_FIND_BODY_SECTION_KEY,
          text,
          meta.selection
        )
      }}
    />
  {/key}
  {#if attachment}
    {#key attachment.note.id}
      <AttachedNoteSection
        {attachment}
        widthPx={virtualWindowWidthPx}
        {devicePixelRatio}
        {rowId}
        {hydrationPriority}
        {shouldDehydrate}
        {overlayRowElement}
        overflowPadding={`${OVERFLOW_TOP_PADDING_PX + monacoHeightPx + PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX + PROMPT_EDITOR_SEPARATOR_HEIGHT_PX * 2 + ATTACHED_NOTE_HEADER_HEIGHT_PX + PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${OVERFLOW_LEFT_PADDING_PX}px`}
        {scrollToWithinWindowBand}
        ontoggle={toggleAttachedNote}
        {onInteraction}
        onEditorLifecycle={handleNoteEditorLifecycle}
      />
    {/key}
  {/if}
</EditorCardSurface>
