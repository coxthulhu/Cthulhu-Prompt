<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Action } from 'svelte/action'
  import { createPromptFolderSettingsModelUri, type monaco } from '@renderer/common/Monaco'
  import {
    PROMPT_FOLDER_SETTINGS_FIELD_METADATA,
    type PromptFolderSettings
  } from '@shared/PromptFolder'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import type { PromptFolderSettingsDraftField } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
  import {
    lookupWorkspacePersistedPromptFolderEditorViewStateJson,
    setPromptFolderEditorViewStateWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import PromptEditorCardSurface from '../prompt-editor/PromptEditorCardSurface.svelte'
  import PromptEditorTitleArea from '../prompt-editor/PromptEditorTitleArea.svelte'
  import { getPromptLineCount, getPromptTokenCount } from '../prompt-editor/promptEditorCounts'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import {
    MONACO_PADDING_PX,
    type PromptEditorSizingConfig
  } from '../prompt-editor/promptEditorSizing'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import type { ComponentType } from 'svelte'
  import { Folder, ListEnd, ListStart } from 'lucide-svelte'
  import { getPromptFolderFindContext } from './find/promptFolderFindContext'
  import type {
    PromptFolderFindRequest,
    PromptFolderFindRowHandle
  } from './find/promptFolderFindTypes'
  import { promptFolderSettingsFindEntityId } from './promptFolderRowIds'
  import {
    SETTINGS_EDITOR_LEFT_OFFSET_PX,
    PROMPT_FOLDER_SETTINGS_TITLE_AREA_HEIGHT_PX,
    SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX,
    SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX,
    SETTINGS_EDITOR_SECTION_PADDING_TOP_PX,
    SETTINGS_EDITOR_TOP_OFFSET_PX,
    getPromptFolderSettingsCardHeightFromRowPx,
    getPromptFolderSettingsFieldMonacoHeightFromRowPx,
    getPromptFolderSettingsFieldRowHeightPx,
    getPromptFolderSettingsSizingConfig
  } from './promptFolderSettingsSizing'

  type SettingsSection = {
    field: PromptFolderSettingsDraftField
    findSectionKey: string
    title: string
    infoText: string
    copyLabel: string
    copyTitle: string
    icon: ComponentType
    value: string
    modelUri: monaco.Uri
    initialViewStateJson: string | null
    viewStateCaptureKey: string
    setViewState: (viewStateJson: string | null) => void
  }

  type SettingsSectionConfig = Omit<
    SettingsSection,
    | 'field'
    | 'findSectionKey'
    | 'value'
    | 'modelUri'
    | 'initialViewStateJson'
    | 'viewStateCaptureKey'
    | 'setViewState'
  > & {
    viewStateCapturePrefix: string
  }

  const SETTINGS_SECTION_CONFIG: Record<PromptFolderSettingsDraftField, SettingsSectionConfig> = {
    folderDescription: {
      title: 'Folder Description',
      infoText:
        'A general description of this folder and the types of prompts that are within it. For informational use only.',
      copyLabel: 'Copy folder description',
      copyTitle: 'Copy folder description',
      icon: Folder,
      viewStateCapturePrefix: 'prompt-folder-description'
    },
    folderPrefix: {
      title: 'Prompt Folder Prefix',
      infoText:
        'Text to add before each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      copyLabel: 'Copy folder prefix',
      copyTitle: 'Copy folder prefix',
      icon: ListStart,
      viewStateCapturePrefix: 'prompt-folder-prefix'
    },
    folderSuffix: {
      title: 'Prompt Folder Suffix',
      infoText:
        'Text to add after each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      copyLabel: 'Copy folder suffix',
      copyTitle: 'Copy folder suffix',
      icon: ListEnd,
      viewStateCapturePrefix: 'prompt-folder-suffix'
    }
  }

  const SETTINGS_FIELD_METADATA_BY_FIELD = Object.fromEntries(
    PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map((metadata) => [metadata.field, metadata])
  ) as Record<PromptFolderSettingsDraftField, (typeof PROMPT_FOLDER_SETTINGS_FIELD_METADATA)[number]>

  type Props = {
    workspaceId: string | null
    promptFolderId: string
    field: PromptFolderSettingsDraftField
    rowId: string
    virtualWindowWidthPx: number
    rowContentLeftOffsetPx?: number
    devicePixelRatio: number
    rowHeightPx: number
    includeBottomGap: boolean
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onHydrationChange?: (isHydrated: boolean) => void
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    folderSettings: PromptFolderSettings
    onSettingsFieldChange: (
      field: PromptFolderSettingsDraftField,
      text: string,
      measurement: TextMeasurement
    ) => void
  }

  let {
    workspaceId,
    promptFolderId,
    field,
    rowId,
    virtualWindowWidthPx,
    rowContentLeftOffsetPx = 0,
    devicePixelRatio,
    rowHeightPx: virtualRowHeightPx,
    includeBottomGap,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    onHydrationChange,
    onEditorLifecycle,
    folderSettings,
    onSettingsFieldChange
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const sizingConfig: PromptEditorSizingConfig = $derived(
    getPromptFolderSettingsSizingConfig(systemSettings.promptFontSize)
  )
  const promptFolderFindEntityId = $derived(promptFolderSettingsFindEntityId(promptFolderId, field))
  const findContext = getPromptFolderFindContext()
  const MONACO_VERTICAL_PADDING_PX = MONACO_PADDING_PX / 2
  const OVERFLOW_LEFT_PADDING_PX = $derived(
    SETTINGS_EDITOR_LEFT_OFFSET_PX + rowContentLeftOffsetPx
  )
  const OVERFLOW_RIGHT_PADDING_PX = SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX
  const OVERFLOW_BOTTOM_PADDING_PX =
    SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX + MONACO_VERTICAL_PADDING_PX

  let rowElement = $state<HTMLDivElement | null>(null)
  let lastFocusRequestId = $state(0)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  let editor = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  let isHydrated = $state(false)
  let requestImmediateHydration = $state<(() => Promise<void>) | null>(null)
  let revealSectionMatch = $state<((query: string, matchIndex: number) => number | null) | null>(
    null
  )

  const section = $derived.by<SettingsSection>(() => {
    const metadata = SETTINGS_FIELD_METADATA_BY_FIELD[field]
    const config = SETTINGS_SECTION_CONFIG[field]
    return {
      ...config,
      field,
      findSectionKey: metadata.findSectionKey,
      value: folderSettings[field],
      modelUri: createPromptFolderSettingsModelUri(promptFolderId, field),
      initialViewStateJson: workspaceId
        ? lookupWorkspacePersistedPromptFolderEditorViewStateJson(workspaceId, promptFolderId, field)
        : null,
      viewStateCaptureKey: `${config.viewStateCapturePrefix}:${promptFolderId}`,
      setViewState: (viewStateJson) => {
        if (!workspaceId) return
        setPromptFolderEditorViewStateWithAutosave(
          workspaceId,
          promptFolderId,
          field,
          viewStateJson
        )
      }
    }
  })
  const cardHeightPx = $derived(
    getPromptFolderSettingsCardHeightFromRowPx(virtualRowHeightPx, includeBottomGap)
  )
  const placeholderMonacoHeightPx = $derived(
    Math.max(
      0,
      getPromptFolderSettingsFieldMonacoHeightFromRowPx(virtualRowHeightPx, includeBottomGap)
    )
  )

  // Side effect: keep the Monaco overflow widget host aligned with this settings field row.
  $effect(() => {
    const next = syncMonacoOverflowHost({
      overlayRowElement,
      overflowHost,
      overflowPaddingHost,
      padding: `${SETTINGS_EDITOR_TOP_OFFSET_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${OVERFLOW_LEFT_PADDING_PX}px`
    })
    overflowPaddingHost = next.overflowPaddingHost
    overflowHost = next.overflowHost
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

  const handleEditorLifecycle = (
    activeEditor: monaco.editor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      editor = activeEditor
    } else if (editor === activeEditor) {
      editor = null
    }
    onEditorLifecycle?.(activeEditor, isActive)
  }

  const ensureHydrated = async (): Promise<boolean> => {
    if (isHydrated) return true
    // Side effect: wait for immediate hydration to mount and activate Monaco.
    await requestImmediateHydration?.()
    return isHydrated
  }

  const focusEditorFromBodyClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.monaco-editor')) return
    if (!editor) {
      await ensureHydrated()
    }

    // Side effect: wait for click-triggered hydration before focusing the settings editor.
    await tick()
    editor?.focus()
  }

  const focusEditorBodyClickAction: Action<HTMLDivElement, unknown> = (node) => {
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

  // Side effect: register this settings field row with the find integration.
  onMount(() => {
    if (!findContext) return
    const handle: PromptFolderFindRowHandle = {
      entityId: promptFolderFindEntityId,
      rowId,
      isHydrated: () => isHydrated,
      ensureHydrated,
      shouldEnsureHydratedForSection: (sectionKey) => sectionKey === section.findSectionKey,
      revealSectionMatch: (sectionKey, query, matchIndex) => {
        if (sectionKey !== section.findSectionKey) return null
        return revealSectionMatch?.(query, matchIndex) ?? null
      },
      getSectionCenterOffset: () => null
    }
    return findContext.registerRow(handle)
  })

  // Side effect: focus the matched settings editor after the find widget closes.
  $effect(() => {
    if (!findContext) return
    const findFocusRequest = findContext.focusRequest
    if (!findFocusRequest || findFocusRequest.requestId === lastFocusRequestId) return
    lastFocusRequestId = findFocusRequest.requestId
    const focusMatch = findFocusRequest.match
    if (focusMatch.entityId !== promptFolderFindEntityId) return
    if (!rowElement) return
    editor?.focus()
  })
</script>

<div
  bind:this={rowElement}
  class="prompt-folder-settings-field-row"
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px;`}
  data-testid={`prompt-folder-settings-${promptFolderId}-${field}`}
  data-virtual-window-row
>
  <PromptEditorCardSurface
    style={`height:${cardHeightPx}px; min-height:${cardHeightPx}px; max-height:${cardHeightPx}px;`}
  >
    <PromptEditorTitleArea
      title={section.title}
      draftText={section.value}
      metadataFolderLabel="Folder Settings"
      lineCount={getPromptLineCount(section.value)}
      tokenCount={getPromptTokenCount(section.value)}
      icon={section.icon}
      copyLabel={section.copyLabel}
      copyTitle={section.copyTitle}
      titleAreaHeightPx={PROMPT_FOLDER_SETTINGS_TITLE_AREA_HEIGHT_PX}
      infoText={section.infoText}
    />

    <Separator />

    <div
      class="prompt-folder-settings-editor-section"
      style={`padding:${SETTINGS_EDITOR_SECTION_PADDING_TOP_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX}px ${SETTINGS_EDITOR_LEFT_OFFSET_PX}px;`}
      use:focusEditorBodyClickAction
    >
      {#if overflowHost}
        {#key `${promptFolderId}:${field}`}
          <HydratableMonacoEditor
            initialValue={section.value}
            initialViewStateJson={section.initialViewStateJson}
            viewStateCaptureKey={section.viewStateCaptureKey}
            modelUri={section.modelUri}
            containerWidthPx={virtualWindowWidthPx}
            placeholderHeightPx={placeholderMonacoHeightPx}
            overflowWidgetsDomNode={overflowHost}
            {sizingConfig}
            {hydrationPriority}
            {shouldDehydrate}
            {rowId}
            {scrollToWithinWindowBand}
            onEditorLifecycle={handleEditorLifecycle}
            findSectionKey={section.findSectionKey}
            {findRequest}
            onFindMatches={(query, count) => {
              findContext?.reportSectionMatchCount(
                promptFolderFindEntityId,
                section.findSectionKey,
                query,
                count
              )
            }}
            onFindMatchReveal={(handler) => {
              revealSectionMatch = handler
            }}
            onSelectionChange={(startOffset, endOffset) => {
              findContext?.reportSelection({
                entityId: promptFolderFindEntityId,
                sectionKey: section.findSectionKey,
                startOffset,
                endOffset
              })
            }}
            onImmediateHydrationRequest={(request) => {
              requestImmediateHydration = request
            }}
            onViewStateCapture={section.setViewState}
            onHydrationChange={handleHydrationChange}
            onChange={(text, meta) => {
              onSettingsFieldChange(field, text, {
                measuredHeightPx: getPromptFolderSettingsFieldRowHeightPx(
                  meta.heightPx,
                  includeBottomGap
                ),
                widthPx: virtualWindowWidthPx,
                devicePixelRatio
              })
            }}
          />
        {/key}
      {:else}
        <MonacoEditorPlaceholder heightPx={placeholderMonacoHeightPx} {sizingConfig} />
      {/if}
    </div>
  </PromptEditorCardSurface>
</div>

<style>
  .prompt-folder-settings-field-row {
    box-sizing: border-box;
    min-width: 0;
  }

  .prompt-folder-settings-editor-section {
    box-sizing: border-box;
    min-width: 0;
  }
</style>
