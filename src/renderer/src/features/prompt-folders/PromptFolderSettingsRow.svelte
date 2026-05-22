<script lang="ts">
  import { onMount } from 'svelte'
  import { createPromptFolderDescriptionModelUri, type monaco } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import InfoRow from '@renderer/common/cthulhu-ui/InfoRow.svelte'
  import SectionHeader from '@renderer/common/cthulhu-ui/SectionHeader.svelte'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import {
    lookupWorkspacePersistedPromptFolderDescriptionEditorViewStateJson,
    setPromptFolderDescriptionEditorViewStateWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import PromptEditorCardSurface from '../prompt-editor/PromptEditorCardSurface.svelte'
  import PromptEditorTitleBar from '../prompt-editor/PromptEditorTitleBar.svelte'
  import { getPromptLineCount, getPromptTokenCount } from '../prompt-editor/promptEditorCounts'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import { getMinMonacoHeightPx, MONACO_PADDING_PX } from '../prompt-editor/promptEditorSizing'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { Folder, Settings } from 'lucide-svelte'
  import { getPromptFolderFindContext } from './find/promptFolderFindContext'
  import { PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY } from './find/promptFolderFindSectionKeys'
  import type {
    PromptFolderFindRequest,
    PromptFolderFindRowHandle
  } from './find/promptFolderFindTypes'
  import { promptFolderSettingsFindEntityId } from './promptFolderRowIds'
  import {
    SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX,
    SETTINGS_DESCRIPTION_CARD_PADDING_PX,
    SETTINGS_EDITOR_LEFT_OFFSET_PX,
    SETTINGS_EDITOR_TOP_OFFSET_PX,
    PROMPT_FOLDER_DESCRIPTION_EDITOR_MAX_LINES,
    PROMPT_FOLDER_DESCRIPTION_EDITOR_MIN_LINES,
    getPromptFolderSettingsHeightPx,
    getPromptFolderSettingsMonacoHeightFromRowPx
  } from './promptFolderSettingsSizing'

  type Props = {
    workspaceId: string | null
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
    workspaceId,
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
  const initialDescriptionEditorViewStateJson = $derived.by(() => {
    if (!workspaceId) {
      return null
    }

    return lookupWorkspacePersistedPromptFolderDescriptionEditorViewStateJson(
      workspaceId,
      promptFolderId
    )
  })
  const promptFolderFindEntityId = $derived(promptFolderSettingsFindEntityId(promptFolderId))

  const descriptionValue = $derived(descriptionText)
  const descriptionLineCount = $derived(getPromptLineCount(descriptionValue))
  const descriptionTokenCount = $derived(getPromptTokenCount(descriptionValue))
  const placeholderMonacoHeightPx = $derived.by(() => {
    return Math.max(
      getMinMonacoHeightPx(promptFontSize, PROMPT_FOLDER_DESCRIPTION_EDITOR_MIN_LINES),
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
    requestImmediateHydration: (() => Promise<void>) | null
    revealSectionMatch: ((query: string, matchIndex: number) => number | null) | null
  }
  let findRowHandlers = $state<FindRowHandlers>({
    requestImmediateHydration: null,
    revealSectionMatch: null
  })
  const findContext = getPromptFolderFindContext()
  const MONACO_VERTICAL_PADDING_PX = MONACO_PADDING_PX / 2

  const OVERFLOW_TOP_PADDING_PX = SETTINGS_EDITOR_TOP_OFFSET_PX
  const OVERFLOW_LEFT_PADDING_PX = SETTINGS_EDITOR_LEFT_OFFSET_PX
  const OVERFLOW_RIGHT_PADDING_PX =
    SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX + SETTINGS_DESCRIPTION_CARD_PADDING_PX
  const OVERFLOW_BOTTOM_PADDING_PX =
    SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX +
    SETTINGS_DESCRIPTION_CARD_PADDING_PX +
    MONACO_VERTICAL_PADDING_PX

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
    // Side effect: wait for immediate hydration to mount and activate Monaco.
    await findRowHandlers.requestImmediateHydration?.()
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
  class="prompt-folder-settings-row"
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px;`}
  data-testid={`prompt-folder-settings-${promptFolderId}`}
  data-virtual-window-row
>
  <SectionHeader
    title="Folder Settings"
    description="Settings that only affect prompts in this folder, and are saved to the workspace."
    headingLevel={1}
    icon={Settings}
    showAccentLine
  />

  <PromptEditorCardSurface>
    <PromptEditorTitleBar
      title="Folder Description"
      draftText={descriptionValue}
      metadataFolderLabel="Folder Settings"
      lineCount={descriptionLineCount}
      tokenCount={descriptionTokenCount}
      icon={Folder}
      copyLabel="Copy folder description"
      copyTitle="Copy folder description"
    />

    <InfoRow
      text="A simple description of this folder and its purpose. Not used for any prompting functionality."
    />

    <div class="prompt-folder-description-editor">
      {#if overflowHost}
        {#key promptFolderId}
          <HydratableMonacoEditor
            initialValue={descriptionValue}
            initialViewStateJson={initialDescriptionEditorViewStateJson}
            viewStateCaptureKey={`prompt-folder-description:${promptFolderId}`}
            modelUri={createPromptFolderDescriptionModelUri(promptFolderId)}
            containerWidthPx={virtualWindowWidthPx}
            placeholderHeightPx={placeholderMonacoHeightPx}
            overflowWidgetsDomNode={overflowHost}
            minLines={PROMPT_FOLDER_DESCRIPTION_EDITOR_MIN_LINES}
            maxLines={PROMPT_FOLDER_DESCRIPTION_EDITOR_MAX_LINES}
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
            onViewStateCapture={(viewStateJson) => {
              if (!workspaceId) return
              setPromptFolderDescriptionEditorViewStateWithAutosave(
                workspaceId,
                promptFolderId,
                viewStateJson
              )
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
        <MonacoEditorPlaceholder
          heightPx={placeholderMonacoHeightPx}
          minLines={PROMPT_FOLDER_DESCRIPTION_EDITOR_MIN_LINES}
          maxLines={PROMPT_FOLDER_DESCRIPTION_EDITOR_MAX_LINES}
        />
      {/if}
    </div>
  </PromptEditorCardSurface>
</div>

<style>
  .prompt-folder-settings-row {
    align-content: start;
    box-sizing: border-box;
    display: grid;
    gap: 24px;
    min-width: 0;
    padding-top: 24px;
  }

  .prompt-folder-description-editor {
    min-width: 0;
  }
</style>
