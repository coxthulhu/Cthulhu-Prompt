<script lang="ts">
  import { onMount } from 'svelte'
  import { createPromptFolderSettingsModelUri, type monaco } from '@renderer/common/Monaco'
  import { PROMPT_FOLDER_SETTINGS_FIELDS } from '@shared/PromptFolder'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import InfoRow from '@renderer/common/cthulhu-ui/InfoRow.svelte'
  import SectionHeader from '@renderer/common/cthulhu-ui/SectionHeader.svelte'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import type { PromptFolderSettingsDraftField } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
  import {
    lookupWorkspacePersistedPromptFolderEditorViewStateJson,
    setPromptFolderEditorViewStateWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import PromptEditorCardSurface from '../prompt-editor/PromptEditorCardSurface.svelte'
  import PromptEditorTitleBar from '../prompt-editor/PromptEditorTitleBar.svelte'
  import { getPromptLineCount, getPromptTokenCount } from '../prompt-editor/promptEditorCounts'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import {
    MONACO_PADDING_PX,
    type PromptEditorSizingConfig
  } from '../prompt-editor/promptEditorSizing'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { Folder, Settings } from 'lucide-svelte'
  import { getPromptFolderFindContext } from './find/promptFolderFindContext'
  import { PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS } from './find/promptFolderFindSectionKeys'
  import type {
    PromptFolderFindRequest,
    PromptFolderFindRowHandle
  } from './find/promptFolderFindTypes'
  import { promptFolderSettingsFindEntityId } from './promptFolderRowIds'
  import {
    SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX,
    SETTINGS_DESCRIPTION_CARD_PADDING_PX,
    SETTINGS_EDITOR_LEFT_OFFSET_PX,
    getPromptFolderDescriptionSizingConfig,
    getPromptFolderSettingsEditorTopOffsetPx,
    getPromptFolderSettingsHeightPx,
    estimatePromptFolderSettingsMonacoHeight
  } from './promptFolderSettingsSizing'

  type SettingsSection = {
    field: PromptFolderSettingsDraftField
    findSectionKey: string
    title: string
    infoText: string
    copyLabel: string
    copyTitle: string
    value: string
    modelUri: monaco.Uri
    initialViewStateJson: string | null
    viewStateCaptureKey: string
    setViewState: (viewStateJson: string | null) => void
  }

  type SettingsSectionConfig = Omit<
    SettingsSection,
    | 'field'
    | 'value'
    | 'modelUri'
    | 'initialViewStateJson'
    | 'viewStateCaptureKey'
    | 'setViewState'
  > & {
    viewStateCapturePrefix: string
  }

  type SectionEditorState = {
    overflowHost: HTMLDivElement | null
    overflowPaddingHost: HTMLDivElement | null
    editor: monaco.editor.IStandaloneCodeEditor | null
    isHydrated: boolean
    monacoHeightPx: number | null
    requestImmediateHydration: (() => Promise<void>) | null
    revealSectionMatch: ((query: string, matchIndex: number) => number | null) | null
  }

  const SETTINGS_SECTION_CONFIG: Record<PromptFolderSettingsDraftField, SettingsSectionConfig> = {
    folderDescription: {
      findSectionKey: PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS.folderDescription,
      title: 'Folder Description',
      infoText:
        'A general description of this folder and the types of prompts that are within it. For informational use only.',
      copyLabel: 'Copy folder description',
      copyTitle: 'Copy folder description',
      viewStateCapturePrefix: 'prompt-folder-description'
    },
    folderPrefix: {
      findSectionKey: PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS.folderPrefix,
      title: 'Prompt Folder Prefix',
      infoText: 'Text to add before each prompt copied from this folder.',
      copyLabel: 'Copy folder prefix',
      copyTitle: 'Copy folder prefix',
      viewStateCapturePrefix: 'prompt-folder-prefix'
    },
    folderSuffix: {
      findSectionKey: PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS.folderSuffix,
      title: 'Prompt Folder Suffix',
      infoText: 'Text to add after each prompt copied from this folder.',
      copyLabel: 'Copy folder suffix',
      copyTitle: 'Copy folder suffix',
      viewStateCapturePrefix: 'prompt-folder-suffix'
    }
  }

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
    prefixText: string
    suffixText: string
    onSettingsFieldChange: (
      field: PromptFolderSettingsDraftField,
      text: string,
      measurement: TextMeasurement
    ) => void
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
    prefixText,
    suffixText,
    onSettingsFieldChange
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const sizingConfig: PromptEditorSizingConfig = $derived(
    getPromptFolderDescriptionSizingConfig(systemSettings.promptFontSize)
  )
  const promptFolderFindEntityId = $derived(promptFolderSettingsFindEntityId(promptFolderId))
  const findContext = getPromptFolderFindContext()
  const MONACO_VERTICAL_PADDING_PX = MONACO_PADDING_PX / 2
  const OVERFLOW_LEFT_PADDING_PX = SETTINGS_EDITOR_LEFT_OFFSET_PX
  const OVERFLOW_RIGHT_PADDING_PX =
    SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX + SETTINGS_DESCRIPTION_CARD_PADDING_PX
  const OVERFLOW_BOTTOM_PADDING_PX =
    SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX +
    SETTINGS_DESCRIPTION_CARD_PADDING_PX +
    MONACO_VERTICAL_PADDING_PX

  const createSectionEditorState = (): SectionEditorState => ({
    overflowHost: null,
    overflowPaddingHost: null,
    editor: null,
    isHydrated: false,
    monacoHeightPx: null,
    requestImmediateHydration: null,
    revealSectionMatch: null
  })

  let rowElement = $state<HTMLDivElement | null>(null)
  let lastFocusRequestId = $state(0)
  let pendingFindHydrationSectionKey = $state<string | null>(null)
  let sectionStates = $state<Record<PromptFolderSettingsDraftField, SectionEditorState>>(
    Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [field, createSectionEditorState()])
    ) as Record<PromptFolderSettingsDraftField, SectionEditorState>
  )

  const settingsTextByField = $derived.by<Record<PromptFolderSettingsDraftField, string>>(() => ({
    folderDescription: descriptionText,
    folderPrefix: prefixText,
    folderSuffix: suffixText
  }))

  const sections = $derived.by<SettingsSection[]>(() =>
    PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => {
      const config = SETTINGS_SECTION_CONFIG[field]
      return {
        ...config,
        field,
        value: settingsTextByField[field],
        modelUri: createPromptFolderSettingsModelUri(promptFolderId, field),
        initialViewStateJson: workspaceId
          ? lookupWorkspacePersistedPromptFolderEditorViewStateJson(
              workspaceId,
              promptFolderId,
              field
            )
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
  )

  const placeholderMonacoHeightBySection = $derived.by<
    Record<PromptFolderSettingsDraftField, number>
  >(() =>
    Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        estimatePromptFolderSettingsMonacoHeight(
          settingsTextByField[field],
          systemSettings.promptFontSize
        )
      ])
    ) as Record<PromptFolderSettingsDraftField, number>
  )

  const effectiveMonacoHeights = $derived.by(() =>
    sections.map((section) => {
      return (
        sectionStates[section.field].monacoHeightPx ??
        placeholderMonacoHeightBySection[section.field]
      )
    })
  )

  const getMeasuredRowHeightPx = (): number =>
    getPromptFolderSettingsHeightPx(effectiveMonacoHeights)

  // Side effect: align each Monaco overflow widget host with its settings card in the virtualized row.
  $effect(() => {
    for (const [sectionIndex, section] of sections.entries()) {
      const state = sectionStates[section.field]
      const topPaddingPx = getPromptFolderSettingsEditorTopOffsetPx(
        sectionIndex,
        effectiveMonacoHeights.slice(0, sectionIndex)
      )
      const next = syncMonacoOverflowHost({
        overlayRowElement,
        overflowHost: state.overflowHost,
        overflowPaddingHost: state.overflowPaddingHost,
        padding: `${topPaddingPx}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${OVERFLOW_LEFT_PADDING_PX}px`
      })
      state.overflowPaddingHost = next.overflowPaddingHost
      state.overflowHost = next.overflowHost
    }
  })

  const reportRowHydration = () => {
    const isAnySectionHydrated = sections.some((section) => sectionStates[section.field].isHydrated)
    onHydrationChange?.(isAnySectionHydrated)
    findContext?.reportHydration(promptFolderFindEntityId, isAnySectionHydrated)
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
    sectionKey: PromptFolderSettingsDraftField,
    editor: monaco.editor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      sectionStates[sectionKey].editor = editor
    } else if (sectionStates[sectionKey].editor === editor) {
      sectionStates[sectionKey].editor = null
    }
    onEditorLifecycle?.(editor, isActive)
  }

  const ensureHydrated = async (sectionKey: string): Promise<boolean> => {
    const section = sections.find((candidate) => candidate.findSectionKey === sectionKey)
    if (!section) return false
    const state = sectionStates[section.field]
    if (state.isHydrated) return true
    // Side effect: wait for immediate hydration to mount and activate Monaco.
    await state.requestImmediateHydration?.()
    return state.isHydrated
  }

  // Side effect: register this row with the find integration for navigation.
  onMount(() => {
    if (!findContext) return
    const handle: PromptFolderFindRowHandle = {
      entityId: promptFolderFindEntityId,
      rowId,
      isHydrated: () => sections.some((section) => sectionStates[section.field].isHydrated),
      ensureHydrated: async () => true,
      shouldEnsureHydratedForSection: (sectionKey) => {
        pendingFindHydrationSectionKey = sectionKey
        return sections.some((section) => section.findSectionKey === sectionKey)
      },
      revealSectionMatch: (sectionKey, query, matchIndex) => {
        const section = sections.find((candidate) => candidate.findSectionKey === sectionKey)
        if (!section) return null
        return sectionStates[section.field].revealSectionMatch?.(query, matchIndex) ?? null
      },
      getSectionCenterOffset: () => null
    }
    return findContext.registerRow({
      ...handle,
      ensureHydrated: async () => ensureHydrated(pendingFindHydrationSectionKey ?? '')
    })
  })

  // Side effect: focus the matched folder settings editor after the find widget closes.
  $effect(() => {
    if (!findContext) return
    const findFocusRequest = findContext.focusRequest
    if (!findFocusRequest || findFocusRequest.requestId === lastFocusRequestId) return
    lastFocusRequestId = findFocusRequest.requestId
    const focusMatch = findFocusRequest.match
    if (focusMatch.entityId !== promptFolderFindEntityId) return
    if (!rowElement) return
    const section = sections.find((candidate) => candidate.findSectionKey === focusMatch.sectionKey)
    if (!section) return
    sectionStates[section.field].editor?.focus()
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

  {#each sections as section (section.field)}
    {@const state = sectionStates[section.field]}
    {@const placeholderMonacoHeightPx = placeholderMonacoHeightBySection[section.field]}
    <PromptEditorCardSurface>
      <PromptEditorTitleBar
        title={section.title}
        draftText={section.value}
        metadataFolderLabel="Folder Settings"
        lineCount={getPromptLineCount(section.value)}
        tokenCount={getPromptTokenCount(section.value)}
        icon={Folder}
        copyLabel={section.copyLabel}
        copyTitle={section.copyTitle}
      />

      <InfoRow text={section.infoText} />

      <div class="prompt-folder-settings-editor">
        {#if state.overflowHost}
          {#key `${promptFolderId}:${section.field}`}
            <HydratableMonacoEditor
              initialValue={section.value}
              initialViewStateJson={section.initialViewStateJson}
              viewStateCaptureKey={section.viewStateCaptureKey}
              modelUri={section.modelUri}
              containerWidthPx={virtualWindowWidthPx}
              placeholderHeightPx={placeholderMonacoHeightPx}
              overflowWidgetsDomNode={state.overflowHost}
              {sizingConfig}
              {hydrationPriority}
              {shouldDehydrate}
              {rowId}
              {scrollToWithinWindowBand}
              onEditorLifecycle={(editor, isActive) => {
                handleEditorLifecycle(section.field, editor, isActive)
              }}
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
                state.revealSectionMatch = handler
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
                state.requestImmediateHydration = request
              }}
              onViewStateCapture={section.setViewState}
              onHydrationChange={(nextIsHydrated) => {
                state.isHydrated = nextIsHydrated
                reportRowHydration()
              }}
              onChange={(text, meta) => {
                state.monacoHeightPx = meta.heightPx
                onSettingsFieldChange(section.field, text, {
                  measuredHeightPx: getMeasuredRowHeightPx(),
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
  {/each}
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

  .prompt-folder-settings-editor {
    min-width: 0;
  }
</style>
