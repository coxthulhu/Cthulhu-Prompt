<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Action } from 'svelte/action'
  import { createPromptFolderSettingsModelUri, type monaco } from '@renderer/common/Monaco'
  import {
    PROMPT_FOLDER_SETTINGS_FIELD_METADATA,
    type PromptFolderSettings
  } from '@shared/PromptFolder'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import type { PromptFolderSettingsDraftField } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
  import {
    lookupWorkspacePersistedPromptFolderEditorViewStateJson,
    setPromptFolderEditorViewStateWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import EditorCardSection from '../prompt-editor/EditorCardSection.svelte'
  import HydratableMonacoEditor from '../prompt-editor/HydratableMonacoEditor.svelte'
  import MonacoEditorPlaceholder from '../prompt-editor/MonacoEditorPlaceholder.svelte'
  import { syncMonacoOverflowHost } from '../prompt-editor/monacoOverflowHost'
  import {
    MONACO_PADDING_PX,
    type PromptEditorSizingConfig
  } from '../prompt-editor/promptEditorSizing'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { getPromptFolderFindContext } from './find/promptFolderFindContext'
  import type {
    PromptFolderFindRequest,
    PromptFolderFindRowHandle
  } from './find/promptFolderFindTypes'
  import { promptFolderSettingsFindEntityId } from './promptFolderRowIds'
  import {
    SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX,
    SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX,
    SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX,
    SETTINGS_EDITOR_SECTION_PADDING_TOP_PX,
    getPromptFolderSettingsFieldMonacoHeightFromRowPx,
    getPromptFolderSettingsFieldRowHeightPx,
    getPromptFolderSettingsSizingConfig
  } from './promptFolderSettingsSizing'

  type SettingsSectionConfig = {
    title: string
    description: string
    viewStateCapturePrefix: string
  }

  const SETTINGS_SECTION_CONFIG: Record<PromptFolderSettingsDraftField, SettingsSectionConfig> = {
    folderDescription: {
      title: 'Folder Description',
      description:
        'A general description of this folder and the types of prompts that are within it. For informational use only.',
      viewStateCapturePrefix: 'prompt-folder-description'
    },
    folderPrefix: {
      title: 'Prompt Folder Prefix',
      description:
        'Text to add before each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      viewStateCapturePrefix: 'prompt-folder-prefix'
    },
    folderSuffix: {
      title: 'Prompt Folder Suffix',
      description:
        'Text to add after each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
      viewStateCapturePrefix: 'prompt-folder-suffix'
    }
  }

  const SETTINGS_FIELD_METADATA_BY_FIELD = Object.fromEntries(
    PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map((metadata) => [metadata.field, metadata])
  ) as Record<
    PromptFolderSettingsDraftField,
    (typeof PROMPT_FOLDER_SETTINGS_FIELD_METADATA)[number]
  >

  type Props = {
    workspaceId: string | null
    promptFolderId: string
    field: PromptFolderSettingsDraftField
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    sectionHeightPx: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    folderSettings: PromptFolderSettings
    showTopBorder?: boolean
    onHydrationChange?: (field: PromptFolderSettingsDraftField, isHydrated: boolean) => void
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
    devicePixelRatio,
    sectionHeightPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    folderSettings,
    showTopBorder = false,
    onHydrationChange,
    onSettingsFieldChange
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const sizingConfig: PromptEditorSizingConfig = $derived(
    getPromptFolderSettingsSizingConfig(systemSettings.promptFontSize)
  )
  const findContext = getPromptFolderFindContext()
  const promptFolderFindEntityId = $derived(promptFolderSettingsFindEntityId(promptFolderId, field))
  const section = $derived.by(() => {
    const metadata = SETTINGS_FIELD_METADATA_BY_FIELD[field]
    const config = SETTINGS_SECTION_CONFIG[field]
    return {
      ...config,
      findSectionKey: metadata.findSectionKey,
      value: folderSettings[field],
      modelUri: createPromptFolderSettingsModelUri(promptFolderId, field),
      initialViewStateJson: workspaceId
        ? lookupWorkspacePersistedPromptFolderEditorViewStateJson(
            workspaceId,
            promptFolderId,
            field
          )
        : null,
      viewStateCaptureKey: `${config.viewStateCapturePrefix}:${promptFolderId}`
    }
  })
  const placeholderMonacoHeightPx = $derived(
    Math.max(0, getPromptFolderSettingsFieldMonacoHeightFromRowPx(sectionHeightPx))
  )

  let sectionElement = $state<HTMLElement | null>(null)
  let editorBodyElement = $state<HTMLDivElement | null>(null)
  let overflowHost = $state<HTMLDivElement | null>(null)
  let overflowPaddingHost = $state<HTMLDivElement | null>(null)
  let editor = $state<monaco.editor.IStandaloneCodeEditor | null>(null)
  let isHydrated = $state(false)
  let lastFocusRequestId = $state(0)
  let requestImmediateHydration = $state<(() => Promise<void>) | null>(null)
  let revealSectionMatch = $state<((query: string, matchIndex: number) => number | null) | null>(
    null
  )

  // Side effect: keep the Monaco overflow host aligned to this section's editor body.
  $effect(() => {
    let padding = `${SETTINGS_EDITOR_SECTION_PADDING_TOP_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX}px`
    if (overlayRowElement && editorBodyElement) {
      const rowRect = overlayRowElement.getBoundingClientRect()
      const bodyRect = editorBodyElement.getBoundingClientRect()
      const verticalInsetPx = MONACO_PADDING_PX / 2
      const topPx = Math.max(
        0,
        bodyRect.top - rowRect.top + SETTINGS_EDITOR_SECTION_PADDING_TOP_PX + verticalInsetPx
      )
      const rightPx = Math.max(
        0,
        rowRect.right - bodyRect.right + SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX
      )
      const bottomPx = Math.max(
        0,
        rowRect.bottom -
          bodyRect.bottom +
          SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX +
          verticalInsetPx
      )
      const leftPx = Math.max(
        0,
        bodyRect.left - rowRect.left + SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX
      )
      padding = `${topPx}px ${rightPx}px ${bottomPx}px ${leftPx}px`
    }

    const next = syncMonacoOverflowHost({
      overlayRowElement,
      overflowHost,
      overflowPaddingHost,
      padding
    })
    overflowPaddingHost = next.overflowPaddingHost
    overflowHost = next.overflowHost
  })

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

  const setViewState = (viewStateJson: string | null) => {
    if (!workspaceId) return
    setPromptFolderEditorViewStateWithAutosave(workspaceId, promptFolderId, field, viewStateJson)
  }

  const handleHydrationChange = (nextIsHydrated: boolean) => {
    isHydrated = nextIsHydrated
    onHydrationChange?.(field, nextIsHydrated)
    findContext?.reportHydration(promptFolderFindEntityId, nextIsHydrated)
  }

  const handleEditorLifecycle = (
    activeEditor: monaco.editor.IStandaloneCodeEditor,
    isActive: boolean
  ) => {
    if (isActive) {
      editor = activeEditor
    } else if (editor === activeEditor) {
      editor = null
    }
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

  // Side effect: register this settings section with find navigation.
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
    if (!sectionElement) return
    editor?.focus()
  })
</script>

<EditorCardSection
  bind:sectionElement
  title={section.title}
  description={section.description}
  {showTopBorder}
  testId={`prompt-folder-settings-section-${field}`}
>
  <div
    bind:this={editorBodyElement}
    class="prompt-folder-settings-editor-section"
    style={`padding:${SETTINGS_EDITOR_SECTION_PADDING_TOP_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX}px ${SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX}px;`}
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
          onViewStateCapture={setViewState}
          onHydrationChange={handleHydrationChange}
          onChange={(text, meta) => {
            onSettingsFieldChange(field, text, {
              measuredHeightPx: getPromptFolderSettingsFieldRowHeightPx(meta.heightPx),
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
</EditorCardSection>

<style>
  .prompt-folder-settings-editor-section {
    box-sizing: border-box;
    min-width: 0;
  }
</style>
