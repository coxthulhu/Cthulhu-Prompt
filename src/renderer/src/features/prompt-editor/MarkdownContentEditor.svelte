<script lang="ts">
  import { onMount, tick } from 'svelte'
  import AttachedNoteButton from './AttachedNoteButton.svelte'
  import AttachedNoteSection from './AttachedNoteSection.svelte'
  import { ATTACHED_NOTE_HEADER_HEIGHT_PX, getAttachedNoteSectionHeight, getNoteSizingWithPrompt, getPromptSizingWithNote, type AttachedNoteLayout } from './attachedNoteSizing'
  import { createAttachedNote, deleteNote, setAttachedNoteVisible } from '@renderer/data/Mutations/NoteMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { compactGuid } from '@shared/utilities/compactGuid'
  import { registerKeyboardScope } from '@renderer/common/keyboardRouter'
  import { Check, Layers, Maximize2, Minimize2, Plus } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import EditorSplitHandle from './EditorSplitHandle.svelte'
  import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
  import { USER_PERSISTENCE_ID } from '@shared/domain/user-persistence/UserPersistence'
  import { setSinglePromptNoteFractionWithAutosave } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
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
    getLineHeightPx,
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
    layout = 'card',
    onOpen,
    onClose,
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
    /** Card renders a virtual-row card; screen fills the single-prompt editor with resizable editors. */
    layout?: 'card' | 'screen'
    /** Opens this prompt in the single-prompt editor; omitted where it is already open. */
    onOpen?: () => void
    /** Closes the single-prompt editor that is showing this prompt. */
    onClose?: () => void
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
    /** Card width in the card layout, or the screen width in the screen layout. */
    virtualWindowWidthPx: number
    rowContentLeftOffsetPx?: number
    devicePixelRatio: number
    /** Pinned card height in the card layout, or the available screen height in the screen layout. */
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
  /** Shared typography and line budget before the prompt and its note divide it. */
  const sharedSizingConfig: PromptEditorSizingConfig = $derived({
    fontSize: systemSettings.promptFontSize,
    minLines: systemSettings.promptEditorMinLines,
    maxLines: systemSettings.promptEditorMaxLines
  })
  const promptEditorSizingConfig: PromptEditorSizingConfig = $derived(
    getPromptSizingWithNote(sharedSizingConfig, systemSettings.attachedNoteReservedLines, attachment)
  )
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
  /** Note line limits that grow into any shared lines the prompt's displayed height leaves unused. */
  const noteEditorSizingConfig = $derived(
    getNoteSizingWithPrompt(sharedSizingConfig, systemSettings.attachedNoteReservedLines, monacoHeightPx)
  )
  let rowElement = $state<HTMLDivElement | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  let titleInputRef = $state<HTMLInputElement | null>(null)
  let editorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  /** Separate focus target for shortcuts issued inside the note. */
  let noteEditorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  /** Only a newly added note requests automatic editor focus. */
  let focusNewNoteId = $state<string | null>(null)

  /** Adds and reveals a new note, deletes a blank note on hide, or toggles an existing note without moving focus. */
  const toggleAttachedNote = (): void => {
    onInteraction?.()
    void runIpcBestEffort(async () => {
      if (attachment?.visible && attachment.note.noteText.trim().length === 0) {
        await deleteNote(attachment.note.id)
      } else if (attachment) {
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

  /** Zero-height popup anchor placed directly above the screen layout's body editor. */
  let bodyOverlayAnchor = $state<HTMLDivElement | null>(null)
  /** Zero-height popup anchor placed directly above the screen layout's note section. */
  let noteOverlayAnchor = $state<HTMLDivElement | null>(null)
  /** Screen anchors sit at their editor section's origin, so only the editor padding offsets popups. */
  const SCREEN_BODY_OVERFLOW_PADDING = `${PROMPT_EDITOR_BODY_PADDING_TOP_PX + MONACO_VERTICAL_PADDING_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px`
  /** Note popups also skip the note's separators and header. */
  const SCREEN_NOTE_OVERFLOW_PADDING = `${PROMPT_EDITOR_SEPARATOR_HEIGHT_PX * 2 + ATTACHED_NOTE_HEADER_HEIGHT_PX + PROMPT_EDITOR_BODY_PADDING_TOP_PX + MONACO_VERTICAL_PADDING_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px`
  /** One rendered line, the minimum height of each screen-layout editor. */
  const lineHeightPx = $derived(getLineHeightPx(systemSettings.promptFontSize))
  /** Header, optional template bar, separators, and body padding around the screen-layout body editor. */
  const screenBodyChromePx = $derived(
    titleAreaHeightPx +
      PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
      subtitleBarHeightPx +
      (subtitleBarHeightPx > 0 ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX : 0) +
      PROMPT_EDITOR_BODY_PADDING_TOP_PX +
      PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX
  )
  /** Note separator and header, plus its editor chrome while expanded. */
  const screenNoteChromePx = $derived(
    attachment
      ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX + ATTACHED_NOTE_HEADER_HEIGHT_PX +
          (attachment.visible
            ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX + PROMPT_EDITOR_BODY_PADDING_TOP_PX + PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX
            : 0)
      : 0
  )
  /** Height shared by the screen layout's body editor and an expanded note editor. */
  const screenEditorsHeightPx = $derived(virtualRowHeightPx - screenBodyChromePx - screenNoteChromePx)
  /** Machine-wide share of the editor height given to an expanded note, seeded from persistence. */
  let noteFraction = $state(userPersistenceCollection.get(USER_PERSISTENCE_ID)!.singlePromptNoteFraction)
  /** Expanded note editor height, keeping at least one line for both editors. */
  const screenNoteEditorHeightPx = $derived(
    attachment?.visible
      ? Math.min(
          Math.max(Math.round(screenEditorsHeightPx * noteFraction), lineHeightPx),
          screenEditorsHeightPx - lineHeightPx
        )
      : 0
  )
  /** Body editor fills the remaining screen-layout height. */
  const screenBodyEditorHeightPx = $derived(screenEditorsHeightPx - screenNoteEditorHeightPx)
  /** Note editor height when the current split-handle drag began. */
  let resizeStartNoteHeightPx = 0

  /** Moves the split by the drag distance, clamps both editors to one line, and saves the new share. */
  const resizeNote = (deltaPx: number): void => {
    /** Requested note height, clamped to the same one-line minimums as the derived layout. */
    const noteHeightPx = Math.min(
      Math.max(resizeStartNoteHeightPx - deltaPx, lineHeightPx),
      screenEditorsHeightPx - lineHeightPx
    )
    noteFraction = noteHeightPx / screenEditorsHeightPx
    setSinglePromptNoteFractionWithAutosave(noteFraction)
  }

  // Side effect: keep the Monaco overflow host aligned with the prompt editor chrome.
  $effect(() => {
    const next = syncMonacoOverflowHost({
      overlayRowElement: layout === 'screen' ? bodyOverlayAnchor : overlayRowElement,
      overflowHost,
      overflowPaddingHost,
      padding: layout === 'screen'
        ? SCREEN_BODY_OVERFLOW_PADDING
        : `${OVERFLOW_TOP_PADDING_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${OVERFLOW_LEFT_PADDING_PX}px`
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

  /** Focuses an editor with one collapsed cursor at the document edge nearest the field being left. */
  const focusEditorAtEdge = (
    editor: monaco.editor.IStandaloneCodeEditor | null,
    edge: 'start' | 'end'
  ) => {
    if (!editor) return
    /** Model edge facing the direction the caret arrived from. */
    const position =
      edge === 'start'
        ? new monaco.Position(1, 1)
        : editor.getModel()!.getFullModelRange().getEndPosition()
    // A keyboard source lets the collection keep the moved caret within its scroll band.
    editor.setPosition(position, 'keyboard')
    editor.revealPosition(position)
    editor.focus()
  }

  /** Moves from the title to the body, at its start for ArrowDown or its retained selection for Enter. */
  const focusEditorFromTitle = async (atStart: boolean) => {
    if (!editorInstance) {
      await ensureHydrated()
    }

    // Side effect: wait for Monaco lifecycle registration before moving keyboard focus.
    await tick()
    if (atStart) focusEditorAtEdge(editorInstance, 'start')
    else editorInstance?.focus()
  }

  /** Moves keyboard focus from the body's start to the end of this row's title. */
  const focusTitleEndFromBody = () => {
    const input = titleInputRef!
    // Place the caret before focusing so Find records the arrival position.
    input.setSelectionRange(input.value.length, input.value.length)
    input.focus({ preventScroll: true })
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

  // Side effect: register this mounted card's move shortcuts and release them on unmount.
  // The screen layout omits them because the move would not be visible.
  onMount(() => layout === 'screen' ? undefined : registerKeyboardScope({
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

<!-- Drag rail shared by the card's full-height sidebar and the screen header. -->
{#snippet editorSidebar()}
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

<!-- Title, metadata, status accent, and toolbar shared by both layouts. -->
{#snippet titleArea()}
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
    {#snippet trailingActions()}
      <AttachedNoteButton noteId={attachment?.note.id} noteText={attachment?.note.noteText} visible={attachment?.visible ?? false} ontoggle={toggleAttachedNote} />
      {#if onOpen}
        <IconButton
          icon={Maximize2}
          label="Open in editor"
          title="Open in editor"
          testId="prompt-open-button"
          onclick={onOpen}
        />
      {/if}
      {#if onClose}
        <IconButton
          icon={Minimize2}
          label="Close full screen editor"
          title="Close full screen editor"
          testId="prompt-close-button"
          onclick={onClose}
        />
      {/if}
    {/snippet}
  </PromptEditorTitleArea>
{/snippet}

<!-- Template-only parameter bar shared by both layouts. -->
{#snippet subtitleBar()}
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
{/snippet}

<!-- Main prompt or template text editor shared by both layouts. -->
{#snippet bodyEditor()}
  {#key promptId}
    <MonacoEditorSection
      class="prompt-editor-body-editor-section"
      initialValue={promptData.draft.text}
      initialViewStateJson={initialEditorViewStateJson}
      viewStateCaptureKey={`content:${promptId}`}
      {modelUri}
      containerWidthPx={virtualWindowWidthPx}
      placeholderHeightPx={layout === 'screen' ? screenBodyEditorHeightPx : placeholderMonacoHeightPx}
      fixedHeightPx={layout === 'screen' ? screenBodyEditorHeightPx : undefined}
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
      onArrowUpAtStart={focusTitleEndFromBody}
      onArrowDownAtEnd={() => focusEditorAtEdge(noteEditorInstance, 'start')}
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
          // Screen editors have a fixed height, so their measurement uses the card-clamped content height.
          measuredHeightPx: getRowHeightPx(
            layout === 'screen' ? clampMonacoHeightPx(meta.contentHeightPx, promptEditorSizingConfig) : meta.heightPx,
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
{/snippet}

<!-- Collapsible attached note shared by both layouts. -->
{#snippet noteSection()}
  {#if attachment}
    {#key attachment.note.id}
      <AttachedNoteSection
        {attachment}
        sizingConfig={noteEditorSizingConfig}
        widthPx={virtualWindowWidthPx}
        {devicePixelRatio}
        {rowId}
        {hydrationPriority}
        {shouldDehydrate}
        overlayRowElement={layout === 'screen' ? noteOverlayAnchor : overlayRowElement}
        fixedHeightPx={layout === 'screen' ? screenNoteEditorHeightPx : undefined}
        overflowPadding={layout === 'screen' ? SCREEN_NOTE_OVERFLOW_PADDING : `${OVERFLOW_TOP_PADDING_PX + monacoHeightPx + PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX + PROMPT_EDITOR_SEPARATOR_HEIGHT_PX * 2 + ATTACHED_NOTE_HEADER_HEIGHT_PX + PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${OVERFLOW_LEFT_PADDING_PX}px`}
        {scrollToWithinWindowBand}
        ontoggle={toggleAttachedNote}
        {onInteraction}
        onEditorLifecycle={handleNoteEditorLifecycle}
        onArrowUpAtStart={() => focusEditorAtEdge(editorInstance, 'end')}
      />
    {/key}
  {/if}
{/snippet}

{#if layout === 'card'}
  <EditorCardSurface
    bind:rowElement
    showSidebar
    style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px;`}
    data-testid={`prompt-editor-${promptId}`}
    data-dragging={isDragging ? 'true' : 'false'}
    data-virtual-window-row=""
  >
    {#snippet sidebar()}
      {@render editorSidebar()}
    {/snippet}

    {@render titleArea()}
    <Separator />
    {@render subtitleBar()}
    {@render bodyEditor()}
    {@render noteSection()}
  </EditorCardSurface>
{:else}
  <div
    bind:this={rowElement}
    class="markdown-content-editor-screen"
    data-testid={`prompt-editor-${promptId}`}
    data-layout="screen"
    data-virtual-window-row=""
  >
    <div class="markdown-content-editor-screen-header" style={`height:${titleAreaHeightPx}px;`}>
      {@render editorSidebar()}
      {@render titleArea()}
    </div>
    <Separator />
    {@render subtitleBar()}
    <div class="markdown-content-editor-overlay-anchor" bind:this={bodyOverlayAnchor}></div>
    {@render bodyEditor()}
    {#if attachment?.visible}
      <EditorSplitHandle
        label="Resize attached note"
        testId="attached-note-split-handle"
        onResizeStart={() => {
          resizeStartNoteHeightPx = screenNoteEditorHeightPx
        }}
        onResize={resizeNote}
      />
    {/if}
    <div class="markdown-content-editor-overlay-anchor" bind:this={noteOverlayAnchor}></div>
    {@render noteSection()}
  </div>
{/if}

<style>
  .markdown-content-editor-screen {
    background: var(--ui-card-normal-surface);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    min-width: 0;
    position: relative;
  }

  .markdown-content-editor-screen-header {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: 32px minmax(0, 1fr);
    min-width: 0;
  }

  /* Unclipped zero-height origin for Monaco popups, painted above the editors that follow it. */
  .markdown-content-editor-overlay-anchor {
    height: 0;
    overflow: visible;
    position: relative;
    z-index: var(--z-overlay);
  }
</style>
