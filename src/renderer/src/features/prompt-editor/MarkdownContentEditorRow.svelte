<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Action } from 'svelte/action'
  import { Check, Layers, Plus } from 'lucide-svelte'
  import { createPromptEditorModelUri, monaco } from '@renderer/common/Monaco'
  import { PromptStatus } from '@shared/Prompt'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import type { PromptHandleDropPayload } from '@renderer/features/drag-drop/promptHandleDrag'
  import { promptEntryDragState } from '@renderer/features/drag-drop/promptEntryDragState.svelte.ts'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import EditorCardSurface from './EditorCardSurface.svelte'
  import EditorSubtitleBar from './EditorSubtitleBar.svelte'
  import PromptEditorSidebar from './PromptEditorSidebar.svelte'
  import PromptEditorTitleArea from './PromptEditorTitleArea.svelte'
  import HydratableMonacoEditor from './HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from './MonacoEditorPlaceholder.svelte'
  import { syncMonacoOverflowHost } from './monacoOverflowHost'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { getPromptDisplayTitle as getPromptTitleText } from '@shared/promptFallbackTitle'
  import {
    lookupMarkdownContentEditorViewStateJson,
    setMarkdownContentEditorViewStateJson
  } from '@renderer/data/UiState/MarkdownContentUiStateDraftMutations.svelte.ts'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { getPromptFolderFindContext } from '../prompt-folders/find/promptFolderFindContext'
  import { findMatchRange } from '../prompt-folders/find/promptFolderFindText'
  import type {
    PromptFolderFindRequest,
    PromptFolderFindRowHandle
  } from '../prompt-folders/find/promptFolderFindTypes'
  import {
    PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
    PROMPT_FOLDER_FIND_TITLE_SECTION_KEY
  } from '../prompt-folders/find/promptFolderFindSectionKeys'
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
  import { PromptFolderScreenMode } from '../prompt-folders/promptFolderScreenMode'
  import { PROMPT_TEXT_TEMPLATE_PARAMETER } from './promptTemplateParameters'
  import { applyPromptTemplates } from './promptTemplatingEngine'

  // Shared editor implementation; prompt and template wrappers provide the variant behavior.
  let {
    promptId,
    promptFolderId,
    screenRootFolderId,
    workspaceId,
    promptDraftRecord,
    contentKind = 'prompt',
    contentLabel = 'prompt',
    metadataFolderLabel = 'Template',
    metadataFolderState = 'not-selected',
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
    onTemplateSelect,
    onTemplateSelectAndCopy,
    onCopySuccess,
    copyLabel,
    copyTitle,
    deleteLabel,
    deleteDialogTitle,
    deleteDialogDescription,
    screenMode = PromptFolderScreenMode.Active,
    status = PromptStatus.Todo,
    completedAt = null,
    scrollToWithinWindowBand,
    isFirstPrompt,
    isLastPrompt,
    isDragEnabled = true,
    onEditorLifecycle,
    onDelete,
    onStatusChange,
    onMoveUp,
    onMoveDown,
    onPromptTreeDrop
  }: {
    promptId: string
    promptFolderId: string
    screenRootFolderId: string
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
    contentKind?: import('@shared/PromptFolder').PromptFolderContentKind
    contentLabel?: string
    metadataFolderLabel?: string | null
    metadataFolderState?: 'not-selected' | 'no-template' | 'selected'
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
    onTemplateSelect?: () => void
    onTemplateSelectAndCopy?: () => void
    onCopySuccess?: () => void | Promise<void>
    copyLabel?: string
    copyTitle?: string
    deleteLabel?: string
    deleteDialogTitle?: string
    deleteDialogDescription?: string
    screenMode?: PromptFolderScreenMode
    status?: PromptStatus
    completedAt?: string | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    isFirstPrompt: boolean
    isLastPrompt: boolean
    isDragEnabled?: boolean
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    onDelete: () => void
    onStatusChange?: (status: PromptStatus) => void
    onMoveUp: () => Promise<boolean>
    onMoveDown: () => Promise<boolean>
    onPromptTreeDrop: (dropPayload: PromptHandleDropPayload | null) => void | Promise<void>
  } = $props()
  const systemSettings = getSystemSettingsContext()
  const promptNavigation = getPromptNavigationContext()
  const promptEditorSizingConfig: PromptEditorSizingConfig = $derived({
    fontSize: systemSettings.promptFontSize,
    minLines: systemSettings.promptEditorMinLines,
    maxLines: systemSettings.promptEditorMaxLines
  })
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const sidebarWidthPx = $derived(isCompletedMode ? 0 : PROMPT_EDITOR_SIDEBAR_WIDTH_PX)
  const titleAreaWidthPx = $derived(
    getPromptEditorTitleAreaWidthPx(virtualWindowWidthPx, !isCompletedMode)
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
  const initialEditorViewStateJson = $derived(lookupMarkdownContentEditorViewStateJson(promptId))
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
        virtualRowHeightPx,
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
      draggedEntry.folderId === promptFolderId &&
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
  let isHydrated = $state(false)
  type FindRowHandlers = {
    requestImmediateHydration: (() => Promise<void>) | null
    revealSectionMatch: ((query: string, matchIndex: number) => number | null) | null
  }
  let findRowHandlers = $state<FindRowHandlers>({
    requestImmediateHydration: null,
    revealSectionMatch: null
  })
  const findContext = getPromptFolderFindContext()

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
    findContext?.reportHydration(promptId, nextIsHydrated)
  }

  const findRequest = $derived.by<PromptFolderFindRequest | null>(() => {
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

  const handleFindMatches = (query: string, count: number) => {
    findContext?.reportSectionMatchCount(
      promptId,
      PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
      query,
      count
    )
  }

  const handleTitleChange = (title: string) => {
    promptData.setTitle(title)
    findContext?.reportSectionTextChange(promptId, PROMPT_FOLDER_FIND_TITLE_SECTION_KEY, title)
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

  const reportTitleSelection = (startOffset: number, endOffset: number) => {
    findContext?.reportSelection({
      entityId: promptId,
      sectionKey: PROMPT_FOLDER_FIND_TITLE_SECTION_KEY,
      startOffset,
      endOffset
    })
  }

  const reportBodySelection = (startOffset: number, endOffset: number) => {
    findContext?.reportSelection({
      entityId: promptId,
      sectionKey: PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
      startOffset,
      endOffset
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

  const focusEditorFromBodyClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.monaco-editor')) return
    if (!editorInstance) {
      await ensureHydrated()
    }

    // Side effect: wait for click-triggered hydration before focusing the editor.
    await tick()
    editorInstance?.focus()
  }

  const focusEditorSectionClickAction: Action<HTMLDivElement, unknown> = (node) => {
    const handleClick = (event: MouseEvent) => {
      void focusEditorFromBodyClick(event)
    }

    node.addEventListener('click', handleClick)

    return {
      destroy() {
        node.removeEventListener('click', handleClick)
      }
    }
  }

  // Side effect: register this row with the find integration for navigation.
  onMount(() => {
    if (!findContext) return
    const handle: PromptFolderFindRowHandle = {
      entityId: promptId,
      rowId,
      isHydrated: () => isHydrated,
      requestHydration: () => {
        void ensureHydrated()
      },
      shouldEnsureHydratedForSection: (sectionKey) =>
        sectionKey === PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
      isSectionReady: (sectionKey) =>
        sectionKey === PROMPT_FOLDER_FIND_TITLE_SECTION_KEY
          ? titleInputRef !== null
          : sectionKey === PROMPT_FOLDER_FIND_BODY_SECTION_KEY &&
            editorInstance !== null &&
            findRowHandlers.revealSectionMatch !== null,
      revealSectionMatch: (sectionKey, query, matchIndex) => {
        if (sectionKey !== PROMPT_FOLDER_FIND_BODY_SECTION_KEY) return null
        return findRowHandlers.revealSectionMatch?.(query, matchIndex) ?? null
      },
      getSectionCenterOffset: (sectionKey) =>
        sectionKey === PROMPT_FOLDER_FIND_TITLE_SECTION_KEY ? getTitleCenterOffset() : null
    }
    return findContext.registerRow(handle)
  })

  // Side effect: focus the match target after the find widget closes.
  $effect(() => {
    if (!findContext) return
    const request = findContext.focusRequests.pending
    if (!request) return
    const focusMatch = request.payload.match
    if (focusMatch.entityId !== promptId) return

    if (focusMatch.sectionKey === PROMPT_FOLDER_FIND_TITLE_SECTION_KEY) {
      const input = titleInputRef
      if (!input) return
      findContext.focusRequests.consume(request, ({ query, selectMatch }) => {
        input.focus({ preventScroll: true })
        if (!selectMatch || query.length === 0) return
        const matchRange = findMatchRange(
          promptData.draft.title,
          query,
          focusMatch.sectionMatchIndex
        )
        if (!matchRange) return
        input.setSelectionRange(matchRange.start, matchRange.end)
      })
      return
    }

    if (!editorInstance) return
    findContext.focusRequests.consume(request, () => {
      editorInstance!.focus()
    })
  })

  // Side effect: scroll newly created prompts into view and focus Monaco once hydrated.
  $effect(() => {
    const request = promptNavigation.promptFocusRequests.pending
    if (
      !request ||
      request.payload.screenRootFolderId !== screenRootFolderId ||
      request.payload.promptId !== promptId
    ) {
      return
    }
    if (!isHydrated || !editorInstance) return

    promptNavigation.promptFocusRequests.consume(request, () => {
      if (scrollToWithinWindowBand && rowElement) {
        const viewport = rowElement.closest(
          '[data-testid="prompt-folder-virtual-window"]'
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

      editorInstance!.focus()
    })
  })

  const handleMoveUp = async () => {
    void (await onMoveUp())
  }
  const handleMoveDown = async () => {
    void (await onMoveDown())
  }
</script>

<EditorCardSurface
  bind:rowElement
  showSidebar={!isCompletedMode}
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px;`}
  data-testid={`prompt-editor-${promptId}`}
  data-dragging={isDragging ? 'true' : 'false'}
  data-virtual-window-row=""
>
  {#snippet sidebar()}
    <PromptEditorSidebar
      {promptId}
      {promptFolderId}
      {contentKind}
      {contentLabel}
      title={promptTreeTitle}
      {isFirstPrompt}
      {isLastPrompt}
      {isDragEnabled}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      {onPromptTreeDrop}
    />
  {/snippet}

  <PromptEditorTitleArea
    title={promptData.draft.title}
    draftText={promptData.draft.text}
    {copyText}
    modifiedAt={promptData.modifiedAt}
    {completedAt}
    fallbackTitle={promptData.fallbackTitle}
    {tokenCount}
    onTitleChange={handleTitleChange}
    onSelectionChange={reportTitleSelection}
    onTitleEditorFocus={focusEditorFromTitle}
    bind:inputRef={titleInputRef}
    {rowId}
    {scrollToWithinWindowBand}
    {onDelete}
    {onTemplateSelect}
    {onTemplateSelectAndCopy}
    {onCopySuccess}
    {onStatusChange}
    {metadataFolderLabel}
    {metadataFolderState}
    {copyLabel}
    {copyTitle}
    {deleteLabel}
    {deleteDialogTitle}
    {deleteDialogDescription}
    {status}
    isEdited={promptDraftRecord.isEdited}
    {titleAreaHeightPx}
    compactLayout={compactTitleLayout}
  />

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
        <IconTextButton
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

  <div
    class="prompt-editor-body-editor-section"
    style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
    use:focusEditorSectionClickAction
  >
    {#if overflowHost}
      {#key promptId}
        <HydratableMonacoEditor
          class="bg-[var(--ui-editor-content-surface)]"
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
          findSectionKey={PROMPT_FOLDER_FIND_BODY_SECTION_KEY}
          {findRequest}
          onFindMatches={handleFindMatches}
          onFindMatchReveal={(handler) => {
            findRowHandlers.revealSectionMatch = handler
          }}
          onSelectionChange={reportBodySelection}
          onImmediateHydrationRequest={(request) => {
            findRowHandlers.requestImmediateHydration = request
          }}
          onViewStateCapture={(viewStateJson) => {
            if (!workspaceId) return
            setMarkdownContentEditorViewStateJson(workspaceId, promptId, viewStateJson)
          }}
          onHydrationChange={handleHydrationChange}
          onChange={(text, meta) => {
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
          }}
        />
      {/key}
    {:else}
      <MonacoEditorPlaceholder
        class="bg-[var(--ui-editor-content-surface)]"
        heightPx={placeholderMonacoHeightPx}
        sizingConfig={promptEditorSizingConfig}
      />
    {/if}
  </div>
</EditorCardSurface>

<style>
  :global(.editor-card-surface) {
    transition: opacity var(--ui-animation-duration-fast) ease-out;
  }

  :global(.editor-card-surface[data-dragging='true']) {
    opacity: 0.72;
  }

  .prompt-editor-body-editor-section {
    background: var(--ui-editor-content-surface);
    box-sizing: border-box;
    min-width: 0;
  }
</style>
