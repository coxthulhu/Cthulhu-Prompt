<script lang="ts">
  import { ChevronRight, Folder, Pencil, Settings } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import SeparatorDot from '@renderer/common/cthulhu-ui/SeparatorDot.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import {
    PROMPT_FOLDER_SETTINGS_FIELDS,
    type PromptFolderSettings,
    type PromptFolderSettingsField
  } from '@shared/PromptFolder'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import type { PromptFolderSettingsDraftField } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
  import EditorCardSurface from '../prompt-editor/EditorCardSurface.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import PromptFolderSettingsEditorSection from './PromptFolderSettingsEditorSection.svelte'
  import PromptFolderEditorSidebar from './PromptFolderEditorSidebar.svelte'
  import {
    droppable,
    type DraggableOptions,
    type DroppableOptions
  } from '../drag-drop/dragDrop.svelte.ts'
  import type {
    PromptFolderEntryDragPayload,
    PromptHandleDropPayload,
    PromptTreeEntryDragPayload
  } from '../drag-drop/promptHandleDrag'
  import {
    PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX,
    PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX
  } from './promptFolderSettingsSizing'

  type Props = {
    workspaceId: string | null
    promptFolderId: string
    folderDisplayName: string
    promptCount: number
    completedPromptCount: number
    subfolderCount: number
    folderSettings: PromptFolderSettings
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    rowHeightPx: number
    sectionHeightsPx: Record<PromptFolderSettingsField, number>
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    rowPaddingTopPx?: number
    isSettingsSectionExpanded: boolean
    isPromptsSectionExpanded: boolean
    isReadOnly?: boolean
    canRename?: boolean
    showSidebar?: boolean
    dragOptions?: DraggableOptions<PromptFolderEntryDragPayload, PromptHandleDropPayload>
    dropOptions?: DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload>
    onHydrationChange?: (isHydrated: boolean) => void
    onSettingsSectionToggle: () => void
    onPromptsSectionToggle: () => void
    onRenamePromptFolder: () => void
    onSettingsFieldChange: (
      field: PromptFolderSettingsDraftField,
      text: string,
      measurement: TextMeasurement
    ) => void
  }

  let {
    workspaceId,
    promptFolderId,
    folderDisplayName,
    promptCount,
    completedPromptCount,
    subfolderCount,
    folderSettings,
    rowId,
    virtualWindowWidthPx,
    devicePixelRatio,
    rowHeightPx: virtualRowHeightPx,
    sectionHeightsPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    rowPaddingTopPx = PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX,
    isSettingsSectionExpanded,
    isPromptsSectionExpanded,
    isReadOnly = false,
    canRename = !isReadOnly,
    showSidebar = false,
    dragOptions,
    dropOptions,
    onHydrationChange,
    onSettingsSectionToggle,
    onPromptsSectionToggle,
    onRenamePromptFolder,
    onSettingsFieldChange
  }: Props = $props()

  const promptCountLabel = $derived(`${promptCount} ${promptCount === 1 ? 'prompt' : 'prompts'}`)
  const completedPromptCountLabel = $derived(
    `${completedPromptCount} completed prompt${completedPromptCount === 1 ? '' : 's'}`
  )
  const subfolderCountLabel = $derived(
    `${subfolderCount} ${subfolderCount === 1 ? 'subfolder' : 'subfolders'}`
  )
  const cardHeightPx = $derived(Math.max(0, virtualRowHeightPx - rowPaddingTopPx))
  const hydratedFields = $state<Record<PromptFolderSettingsField, boolean>>({
    folderDescription: false,
    folderPrefix: false,
    folderSuffix: false
  })
  const isAnySectionHydrated = $derived(
    PROMPT_FOLDER_SETTINGS_FIELDS.some((field) => hydratedFields[field])
  )
  const effectiveDropOptions = $derived<
    DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload>
  >(
    dropOptions ?? {
      dragType: 'disabled-prompt-folder-row',
      canDrop: () => false
    }
  )
  let lastReportedHydration = $state<boolean | null>(null)

  const handlePencilClick = (event: MouseEvent) => {
    event.stopPropagation()
    onRenamePromptFolder()
  }

  const handlePencilMouseDown = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const handleSettingsClick = (event: MouseEvent) => {
    event.stopPropagation()
    onSettingsSectionToggle()
  }

  const handleSettingsMouseDown = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const handleSectionHydrationChange = (
    field: PromptFolderSettingsField,
    isHydrated: boolean
  ) => {
    hydratedFields[field] = isHydrated
  }

  // Side effect: hidden settings sections are unmounted and no longer hydrate the virtual row.
  $effect(() => {
    if (isSettingsSectionExpanded && !isReadOnly) return
    PROMPT_FOLDER_SETTINGS_FIELDS.forEach((field) => {
      hydratedFields[field] = false
    })
  })

  // Side effect: report aggregate row hydration to the virtual window.
  $effect(() => {
    if (lastReportedHydration === isAnySectionHydrated) return
    lastReportedHydration = isAnySectionHydrated
    onHydrationChange?.(isAnySectionHydrated)
  })
</script>

<div
  class="prompt-folder-editor-row"
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px; padding-top:${rowPaddingTopPx}px;`}
  data-testid={`prompt-folder-editor-${promptFolderId}`}
  data-prompt-folder-id={promptFolderId}
  data-virtual-window-row
>
  <EditorCardSurface
    {showSidebar}
    style={`height:${cardHeightPx}px; min-height:${cardHeightPx}px; max-height:${cardHeightPx}px;`}
  >
    {#snippet sidebar()}
      {#if dragOptions}
        <PromptFolderEditorSidebar {dragOptions} />
      {/if}
    {/snippet}

    <header
      use:droppable={effectiveDropOptions}
      class="prompt-folder-editor-title-bar"
      style={`height:${PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX}px; min-height:${PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX}px; max-height:${PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
      data-testid="prompt-folder-editor-title-bar"
    >
      <div class="prompt-folder-editor-title-main">
        <IconButton
          icon={ChevronRight}
          label={isPromptsSectionExpanded ? 'Collapse folder prompts' : 'Expand folder prompts'}
          title={isPromptsSectionExpanded ? 'Collapse folder prompts' : 'Expand folder prompts'}
          ariaExpanded={isPromptsSectionExpanded}
          iconSize={24}
          class="prompt-folder-editor-chevron-toggle"
          iconClass="prompt-folder-editor-chevron"
          testId="prompt-folder-editor-title-toggle"
          onclick={onPromptsSectionToggle}
        />

        <IconCell icon={Folder} size="title" />

        <div class="prompt-folder-editor-title-copy">
          <div class="prompt-folder-editor-title-line">
            <span class="prompt-folder-editor-title" title={folderDisplayName}>
              {folderDisplayName}
            </span>
            {#if canRename && !isReadOnly}
              <IconButton
                icon={Pencil}
                label="Rename prompt folder"
                title="Rename prompt folder"
                size="tiny"
                baseVariant="muted"
                hoverVariant="glyph"
                testId="prompt-folder-editor-title-edit"
                onclick={handlePencilClick}
                onmousedown={handlePencilMouseDown}
              />
            {/if}
          </div>

          <div class="prompt-folder-editor-metadata-row">
            <span>{promptCountLabel}</span>
            <SeparatorDot />
            <span>{completedPromptCountLabel}</span>
            <SeparatorDot />
            <span>{subfolderCountLabel}</span>
          </div>
        </div>
      </div>

      {#if !isReadOnly}
        <div class="prompt-folder-editor-title-actions">
          <IconButton
            icon={Settings}
            label={isSettingsSectionExpanded ? 'Hide folder settings' : 'Show folder settings'}
            title={isSettingsSectionExpanded ? 'Hide folder settings' : 'Show folder settings'}
            hoverVariant="accent"
            active={isSettingsSectionExpanded}
            ariaPressed={isSettingsSectionExpanded}
            testId="prompt-folder-editor-settings-toggle"
            onclick={handleSettingsClick}
            onmousedown={handleSettingsMouseDown}
          />
        </div>
      {/if}
    </header>

    <Separator />

    {#if isSettingsSectionExpanded && !isReadOnly}
      <div class="prompt-folder-editor-sections">
        {#each PROMPT_FOLDER_SETTINGS_FIELDS as field, index (field)}
          <PromptFolderSettingsEditorSection
            {workspaceId}
            {promptFolderId}
            {field}
            {rowId}
            {virtualWindowWidthPx}
            {devicePixelRatio}
            sectionHeightPx={sectionHeightsPx[field]}
            {hydrationPriority}
            {shouldDehydrate}
            {overlayRowElement}
            {scrollToWithinWindowBand}
            {folderSettings}
            onHydrationChange={handleSectionHydrationChange}
            showTopBorder={index > 0}
            {onSettingsFieldChange}
          />
        {/each}
      </div>
    {/if}
  </EditorCardSurface>
</div>

<style>
  .prompt-folder-editor-row {
    box-sizing: border-box;
    min-width: 0;
  }

  .prompt-folder-editor-title-bar {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    overflow: hidden;
    padding: 8px 16px;
    user-select: none;
    -webkit-user-select: none;
  }

  .prompt-folder-editor-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 30px 40px minmax(0, 1fr);
    min-width: 0;
  }

  .prompt-folder-editor-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .prompt-folder-editor-title-line {
    align-items: center;
    display: flex;
    gap: 7px;
    min-width: 0;
  }

  .prompt-folder-editor-title {
    color: var(--ui-normal-text);
    font-size: 16px;
    font-weight: 700;
    line-height: 21px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-folder-editor-metadata-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    flex-wrap: nowrap;
    font-size: 12px;
    gap: 8px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .prompt-folder-editor-title-actions {
    align-items: center;
    display: flex;
    gap: 4px;
    min-width: 0;
  }

  :global(.prompt-folder-editor-chevron-toggle.cthulhuUiIconButton) {
    height: 30px;
    width: 30px;
  }

  :global(.prompt-folder-editor-chevron) {
    transform: rotate(0deg);
    transform-origin: center;
    transition: transform 50ms ease-out;
  }

  :global(
    .prompt-folder-editor-chevron-toggle[aria-expanded='true']
      .prompt-folder-editor-chevron
  ) {
    transform: rotate(90deg);
  }

  .prompt-folder-editor-sections {
    background: var(--ui-editor-normal-surface);
    display: grid;
    min-width: 0;
  }
</style>
