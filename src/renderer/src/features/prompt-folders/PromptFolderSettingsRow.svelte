<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { monaco } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import { getMinMonacoHeightPx, MONACO_PADDING_PX } from '../prompt-editor/promptEditorSizing'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { getPromptFolderFindContext } from './find/promptFolderFindContext'
  import { PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY } from './find/promptFolderFindSectionKeys'
  import type {
    PromptFolderFindRequest,
    PromptFolderFindRowHandle
  } from './find/promptFolderFindTypes'
  import { promptFolderSettingsFindEntityId } from './promptFolderRowIds'
  import {
    SETTINGS_EDITOR_TOP_OFFSET_PX,
    getPromptFolderSettingsHeightPx,
    getPromptFolderSettingsMonacoHeightFromRowPx
  } from './promptFolderSettingsSizing'

  type Props = {
    promptFolderId: string
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    rowHeightPx: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onHydrationChange?: (isHydrated: boolean) => void
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    descriptionText: string
    onDescriptionChange: (text: string, measurement: TextMeasurement) => void
  }

  let {
    promptFolderId,
    rowId,
    virtualWindowWidthPx,
    devicePixelRatio,
    rowHeightPx: virtualRowHeightPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    onHydrationChange,
    onEditorLifecycle,
    descriptionText,
    onDescriptionChange
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)
  const promptFolderFindEntityId = $derived(promptFolderSettingsFindEntityId(promptFolderId))

  const descriptionValue = $derived(descriptionText)
  const placeholderMonacoHeightPx = $derived.by(() => {
    return Math.max(
      getMinMonacoHeightPx(promptFontSize, promptEditorMinLines),
      getPromptFolderSettingsMonacoHeightFromRowPx(virtualRowHeightPx)
    )
  })
  const getInitialMonacoHeightPx = () => placeholderMonacoHeightPx
  let monacoHeightPx = $state<number>(getInitialMonacoHeightPx())

  let rowElement = $state<HTMLDivElement | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  let editorInstance = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  let isHydrated = $state(false)
  let lastFocusRequestId = $state(0)

  type FindRowHandlers = {
    requestImmediateHydration: (() => void) | null
    revealSectionMatch: ((query: string, matchIndex: number) => number | null) | null
  }
  let findRowHandlers = $state<FindRowHandlers>({
    requestImmediateHydration: null,
    revealSectionMatch: null
  })
  const findContext = getPromptFolderFindContext()
  const BORDER_WIDTH_PX = 1
  const MONACO_LEFT_PADDING_PX = 12
  const MONACO_VERTICAL_PADDING_PX = MONACO_PADDING_PX / 2

  const OVERFLOW_TOP_PADDING_PX = SETTINGS_EDITOR_TOP_OFFSET_PX
  const OVERFLOW_LEFT_PADDING_PX = BORDER_WIDTH_PX + MONACO_LEFT_PADDING_PX
  const OVERFLOW_RIGHT_PADDING_PX = BORDER_WIDTH_PX
  const OVERFLOW_BOTTOM_PADDING_PX = MONACO_VERTICAL_PADDING_PX

  // Side effect: align Monaco overflow widgets with the description editor inside the virtualized row.
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
    findContext?.reportHydration(promptFolderFindEntityId, nextIsHydrated)
  }

  const findRequest = $derived.by<PromptFolderFindRequest | null>(() => {
    if (!findContext) return null
    const activeMatch =
      findContext.currentMatch?.entityId === promptFolderFindEntityId
        ? findContext.currentMatch
        : null

    return {
      isOpen: findContext.isFindOpen,
      query: findContext.query,
      activeSectionKey: activeMatch?.sectionKey ?? null,
      activeSectionMatchIndex: activeMatch?.sectionMatchIndex ?? null
    }
  })

  const handleFindMatches = (query: string, count: number) => {
    findContext?.reportSectionMatchCount(
      promptFolderFindEntityId,
      PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY,
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

  const reportDescriptionSelection = (startOffset: number, endOffset: number) => {
    findContext?.reportSelection({
      entityId: promptFolderFindEntityId,
      sectionKey: PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY,
      startOffset,
      endOffset
    })
  }

  const ensureHydrated = async (): Promise<boolean> => {
    if (isHydrated) return true
    findRowHandlers.requestImmediateHydration?.()
    // Side effect: wait for immediate hydration to mount the editor.
    await tick()
    return isHydrated
  }

  // Side effect: register this row with the find integration for navigation.
  onMount(() => {
    if (!findContext) return
    const handle: PromptFolderFindRowHandle = {
      entityId: promptFolderFindEntityId,
      rowId,
      isHydrated: () => isHydrated,
      ensureHydrated,
      shouldEnsureHydratedForSection: (sectionKey) =>
        sectionKey === PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY,
      revealSectionMatch: (sectionKey, query, matchIndex) => {
        if (sectionKey !== PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY) return null
        return findRowHandlers.revealSectionMatch?.(query, matchIndex) ?? null
      },
      getSectionCenterOffset: () => null
    }
    return findContext.registerRow(handle)
  })

  // Side effect: focus the folder description editor after the find widget closes.
  $effect(() => {
    if (!findContext) return
    const findFocusRequest = findContext.focusRequest
    if (!findFocusRequest || findFocusRequest.requestId === lastFocusRequestId) return
    lastFocusRequestId = findFocusRequest.requestId
    const focusMatch = findFocusRequest.match
    if (focusMatch.entityId !== promptFolderFindEntityId) return
    if (focusMatch.sectionKey !== PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY) return
    if (!rowElement) return
    editorInstance?.focus()
  })
</script>

<div
  bind:this={rowElement}
  class="flex items-stretch gap-2"
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px;`}
  data-testid={`prompt-folder-settings-${promptFolderId}`}
  data-virtual-window-row
>
  <div class="bg-background flex-1 min-w-0">
    <div class="flex min-w-0">
      <div class="flex-1 flex flex-col min-w-0 pt-6">
        <h2 class="text-lg font-semibold">Folder Settings</h2>
        <p class="mt-2 text-sm font-semibold text-muted-foreground">Folder Description</p>
        <div class="flex-1 min-w-0 mt-2">
          {#if overflowHost}
            {#key promptFolderId}
              <HydratableMonacoEditor
                initialValue={descriptionValue}
                containerWidthPx={virtualWindowWidthPx}
                placeholderHeightPx={placeholderMonacoHeightPx}
                overflowWidgetsDomNode={overflowHost}
                {hydrationPriority}
                {shouldDehydrate}
                {rowId}
                {scrollToWithinWindowBand}
                onEditorLifecycle={handleEditorLifecycle}
                findSectionKey={PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY}
                {findRequest}
                onFindMatches={handleFindMatches}
                onFindMatchReveal={(handler) => {
                  findRowHandlers.revealSectionMatch = handler
                }}
                onSelectionChange={reportDescriptionSelection}
                onImmediateHydrationRequest={(request) => {
                  findRowHandlers.requestImmediateHydration = request
                }}
                onHydrationChange={handleHydrationChange}
                onChange={(text, meta) => {
                  if (meta.heightPx !== monacoHeightPx) {
                    monacoHeightPx = meta.heightPx
                  }
                  onDescriptionChange(text, {
                    measuredHeightPx: getPromptFolderSettingsHeightPx(meta.heightPx),
                    widthPx: virtualWindowWidthPx,
                    devicePixelRatio
                  })
                }}
              />
            {/key}
          {:else}
            <MonacoEditorPlaceholder heightPx={placeholderMonacoHeightPx} />
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
