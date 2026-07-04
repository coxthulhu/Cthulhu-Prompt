<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Action } from 'svelte/action'
  import { createPromptEditorModelUri, type monaco } from '@renderer/common/Monaco'
  import type { PromptFolderSettings } from '@shared/PromptFolder'
  import { PromptStatus } from '@shared/Prompt'
  import type { PromptDraftRecord } from '@renderer/data/Collections/PromptDraftCollection'
  import type { PromptHandleDropPayload } from '@renderer/features/drag-drop/promptHandleDrag'
  import { promptDragState } from '@renderer/features/drag-drop/promptDragState.svelte.ts'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import EditorCardSurface from './EditorCardSurface.svelte'
  import PromptEditorSidebar from './PromptEditorSidebar.svelte'
  import PromptEditorTitleArea from './PromptEditorTitleArea.svelte'
  import HydratableMonacoEditor from './HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from './MonacoEditorPlaceholder.svelte'
  import { syncMonacoOverflowHost } from './monacoOverflowHost'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import {
    getPromptDisplayTitle,
    getPromptFolderScreenPromptData
  } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
  import {
    lookupPromptEditorViewStateJson,
    setPromptEditorViewStateJson
  } from '@renderer/data/UiState/PromptUiStateDraftMutations.svelte.ts'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
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
    getMonacoHeightFromRowPx,
    getRowHeightPx,
    MONACO_PADDING_PX,
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
    PROMPT_EDITOR_BODY_PADDING_LEFT_PX,
    PROMPT_EDITOR_BODY_PADDING_RIGHT_PX,
    PROMPT_EDITOR_BODY_PADDING_TOP_PX,
    PROMPT_EDITOR_SEPARATOR_HEIGHT_PX,
    PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX,
    type PromptEditorSizingConfig
  } from './promptEditorSizing'
  import { getPromptLineCount, getPromptTokenCount } from './promptEditorCounts'
  import { PromptFolderScreenMode } from '../prompt-folders/promptFolderScreenMode'

  type PromptFocusRequest = { promptId: string; requestId: number }

  let {
    promptId,
    promptFolderId,
    workspaceId,
    promptDraftRecord,
    rowId,
    virtualWindowWidthPx,
    rowContentLeftOffsetPx = 0,
    devicePixelRatio,
    rowHeightPx: virtualRowHeightPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    onHydrationChange,
    folderSettings,
    screenMode = PromptFolderScreenMode.Active,
    status = PromptStatus.Todo,
    completedAt = null,
    scrollToWithinWindowBand,
    focusRequest,
    isFirstPrompt,
    isLastPrompt,
    onEditorLifecycle,
    onDelete,
    onComplete,
    onUncomplete,
    onMoveUp,
    onMoveDown,
    onPromptTreeDrop
  }: {
    promptId: string
    promptFolderId: string
    workspaceId: string | null
    promptDraftRecord: PromptDraftRecord
    rowId: string
    virtualWindowWidthPx: number
    rowContentLeftOffsetPx?: number
    devicePixelRatio: number
    rowHeightPx: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    onHydrationChange?: (isHydrated: boolean) => void
    folderSettings: PromptFolderSettings
    screenMode?: PromptFolderScreenMode
    status?: PromptStatus
    completedAt?: string | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    focusRequest?: PromptFocusRequest | null
    isFirstPrompt: boolean
    isLastPrompt: boolean
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    onDelete: () => void
    onComplete?: () => void
    onUncomplete?: () => void
    onMoveUp: () => Promise<boolean>
    onMoveDown: () => Promise<boolean>
    onPromptTreeDrop: (dropPayload: PromptHandleDropPayload | null) => void | Promise<void>
  } = $props()
  const systemSettings = getSystemSettingsContext()
  const promptEditorSizingConfig: PromptEditorSizingConfig = $derived({
    fontSize: systemSettings.promptFontSize,
    minLines: systemSettings.promptEditorMinLines,
    maxLines: systemSettings.promptEditorMaxLines
  })
  const initialEditorViewStateJson = $derived(lookupPromptEditorViewStateJson(promptId))
  // Derived prompt state and sizing so the row updates with virtual window changes.
  const promptData = $derived.by(() => {
    const basePromptData = getPromptFolderScreenPromptData(promptId)
    return {
      ...basePromptData,
      draft: {
        title: promptDraftRecord.title,
        text: promptDraftRecord.promptText
      }
    }
  })
  const placeholderMonacoHeightPx = $derived.by(() => {
    return clampMonacoHeightPx(
      getMonacoHeightFromRowPx(virtualRowHeightPx),
      promptEditorSizingConfig
    )
  })
  const lineCount = $derived(getPromptLineCount(promptData.draft.text))
  const tokenCount = $derived(getPromptTokenCount(promptData.draft.text))
  const promptTreeTitle = $derived(getPromptDisplayTitle(promptId))
  const copyText = $derived.by(() => {
    const parts: string[] = []
    if (folderSettings.folderPrefix.trim().length > 0) {
      parts.push(folderSettings.folderPrefix)
    }
    parts.push(promptData.draft.text)
    if (folderSettings.folderSuffix.trim().length > 0) {
      parts.push(folderSettings.folderSuffix)
    }
    return parts.join('\n\n')
  })
  // Track shared prompt drag state so both editor-handle and prompt-tree drags dim this row.
  const isDragging = $derived(
    promptDragState.draggedPromptRow?.folderId === promptFolderId &&
      promptDragState.draggedPromptRow.promptId === promptId
  )
  const getInitialMonacoHeightPx = () => placeholderMonacoHeightPx
  let monacoHeightPx = $state<number>(getInitialMonacoHeightPx())
  let rowElement = $state<HTMLDivElement | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  let titleInputRef = $state<HTMLInputElement | null>(null)
  let editorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  let lastFocusRequestId = $state(0)
  let lastEditorFocusRequestId = $state(0)
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

  const SIDEBAR_WIDTH_PX = 36
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const sidebarWidthPx = $derived(isCompletedMode ? 0 : SIDEBAR_WIDTH_PX)
  const MONACO_VERTICAL_PADDING_PX = MONACO_PADDING_PX / 2

  const OVERFLOW_TOP_PADDING_PX =
    PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX +
    PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
    PROMPT_EDITOR_BODY_PADDING_TOP_PX +
    MONACO_VERTICAL_PADDING_PX
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
      activeSectionMatchIndex: activeMatch?.sectionMatchIndex ?? null
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

  const focusEditorFromTitleTab = async () => {
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
      ensureHydrated,
      shouldEnsureHydratedForSection: (sectionKey) =>
        sectionKey === PROMPT_FOLDER_FIND_BODY_SECTION_KEY,
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
    const findFocusRequest = findContext.focusRequest
    if (!findFocusRequest || findFocusRequest.requestId === lastFocusRequestId) return
    lastFocusRequestId = findFocusRequest.requestId
    const focusMatch = findFocusRequest.match
    if (focusMatch.entityId !== promptId) return

    if (focusMatch.sectionKey === PROMPT_FOLDER_FIND_TITLE_SECTION_KEY) {
      const input = titleInputRef
      if (!input) return
      input.focus({ preventScroll: true })
      const focusQuery = findFocusRequest.query
      if (focusQuery.length === 0) return
      const matchRange = findMatchRange(
        promptData.draft.title,
        focusQuery,
        focusMatch.sectionMatchIndex
      )
      if (!matchRange) return
      input.setSelectionRange(matchRange.start, matchRange.end)
      return
    }

    editorInstance?.focus()
  })

  // Side effect: scroll sidebar-created prompts into view and focus Monaco once hydrated.
  $effect(() => {
    if (!focusRequest) return
    if (focusRequest.requestId === lastEditorFocusRequestId) return
    if (focusRequest.promptId !== promptId) return
    if (!isHydrated || !editorInstance) return

    lastEditorFocusRequestId = focusRequest.requestId

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

    editorInstance.focus()
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
      title={promptTreeTitle}
      {isFirstPrompt}
      {isLastPrompt}
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
    {lineCount}
    {tokenCount}
    onTitleChange={promptData.setTitle}
    onSelectionChange={reportTitleSelection}
    onTitleForwardTab={focusEditorFromTitleTab}
    bind:inputRef={titleInputRef}
    {rowId}
    {scrollToWithinWindowBand}
    {onDelete}
    {onComplete}
    {onUncomplete}
    {status}
    titleAreaHeightPx={PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}
  />

  <Separator />

  <div
    class="prompt-editor-body-editor-section"
    style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
    use:focusEditorSectionClickAction
  >
    {#if overflowHost}
      {#key promptId}
        <HydratableMonacoEditor
          initialValue={promptData.draft.text}
          initialViewStateJson={initialEditorViewStateJson}
          viewStateCaptureKey={`prompt:${promptId}`}
          modelUri={createPromptEditorModelUri(promptId)}
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
            setPromptEditorViewStateJson(workspaceId, promptId, viewStateJson)
          }}
          onHydrationChange={handleHydrationChange}
          onChange={(text, meta) => {
            if (meta.heightPx !== monacoHeightPx) {
              monacoHeightPx = meta.heightPx
            }
            promptData.setText(text, {
              measuredHeightPx: getRowHeightPx(meta.heightPx),
              widthPx: virtualWindowWidthPx,
              devicePixelRatio
            })
          }}
        />
      {/key}
    {:else}
      <MonacoEditorPlaceholder
        heightPx={placeholderMonacoHeightPx}
        sizingConfig={promptEditorSizingConfig}
      />
    {/if}
  </div>
</EditorCardSurface>

<style>
  :global(.editor-card-surface) {
    transition: opacity 50ms ease-out;
  }

  :global(.editor-card-surface[data-dragging='true']) {
    opacity: 0.72;
  }

  .prompt-editor-body-editor-section {
    box-sizing: border-box;
    min-width: 0;
  }
</style>
