<script lang="ts">
  import { Check, ChevronRight, Folder, Pencil, Plus, Settings, Trash2 } from 'lucide-svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/IconButtonBar.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
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
  import { PROMPT_FOLDER_SETTINGS_EDITOR_CONFIG } from './promptFolderSettingsEditorConfig'
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
    PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX,
    PROMPT_FOLDER_SETTINGS_TOOLBAR_HEIGHT_PX
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
    onDeletePromptFolder: () => void
    onRenamePromptFolder: () => void
    onSettingsFieldChange: (
      field: PromptFolderSettingsDraftField,
      text: string,
      measurement: TextMeasurement
    ) => void
    onSettingsFieldPresenceChange: (
      field: PromptFolderSettingsDraftField,
      isPresent: boolean
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
    onDeletePromptFolder,
    onRenamePromptFolder,
    onSettingsFieldChange,
    onSettingsFieldPresenceChange
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
  const configuredSettingsCount = $derived(
    PROMPT_FOLDER_SETTINGS_FIELDS.filter((field) => folderSettings[field] !== null).length
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
  let focusAfterAddField = $state<PromptFolderSettingsField | null>(null)
  const deleteRequests: Partial<Record<PromptFolderSettingsField, () => void>> = {}

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

  const handleDeleteClick = (event: MouseEvent) => {
    event.stopPropagation()
    onDeletePromptFolder()
  }

  const handleDeleteMouseDown = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const handleSectionHydrationChange = (field: PromptFolderSettingsField, isHydrated: boolean) => {
    hydratedFields[field] = isHydrated
  }

  const handleSettingsFieldToggle = (field: PromptFolderSettingsField) => {
    if (folderSettings[field] !== null) {
      deleteRequests[field]?.()
      return
    }

    focusAfterAddField = field
    onSettingsFieldPresenceChange(field, true)
  }

  const handleDeleteRequestChange = (
    field: PromptFolderSettingsField,
    requestDelete: (() => void) | null
  ) => {
    if (requestDelete) {
      deleteRequests[field] = requestDelete
    } else {
      delete deleteRequests[field]
    }
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
    class="prompt-folder-top-cap"
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
          borderless
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
        <IconButtonBar>
          <IconButton
            icon={Trash2}
            label="Delete prompt folder"
            title="Delete prompt folder"
            hoverVariant="danger"
            testId="prompt-folder-editor-delete-button"
            onclick={handleDeleteClick}
            onmousedown={handleDeleteMouseDown}
          />
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
        </IconButtonBar>
      {/if}
    </header>

    {#if isSettingsSectionExpanded && !isReadOnly}
      <Separator data-testid="prompt-folder-editor-settings-separator" />

      <div class="prompt-folder-editor-settings">
        <div
          class="prompt-folder-settings-toolbar"
          style={`height:${PROMPT_FOLDER_SETTINGS_TOOLBAR_HEIGHT_PX}px; min-height:${PROMPT_FOLDER_SETTINGS_TOOLBAR_HEIGHT_PX}px; max-height:${PROMPT_FOLDER_SETTINGS_TOOLBAR_HEIGHT_PX}px;`}
          data-testid="prompt-folder-settings-toolbar"
        >
          <div class="prompt-folder-settings-heading">
            <Settings size={20} aria-hidden="true" />
            <div class="prompt-folder-settings-heading-copy">
              <span>Folder Settings</span>
              <span class="prompt-folder-settings-metadata">
                {configuredSettingsCount} of {PROMPT_FOLDER_SETTINGS_FIELDS.length} configured
              </span>
            </div>
          </div>

          <div class="prompt-folder-settings-toggles" role="group" aria-label="Folder settings">
            {#each PROMPT_FOLDER_SETTINGS_FIELDS as field (field)}
              {@const isPresent = folderSettings[field] !== null}
              {@const config = PROMPT_FOLDER_SETTINGS_EDITOR_CONFIG[field]}
              <IconTextButton
                icon={Plus}
                pressedIcon={Check}
                text={config.toggleText}
                pressed={isPresent}
                title={`${isPresent ? 'Remove' : 'Add'} ${config.title.toLowerCase()}`}
                testId={`prompt-folder-settings-toggle-${field}`}
                onclick={() => handleSettingsFieldToggle(field)}
              />
            {/each}
          </div>
        </div>

        {#if configuredSettingsCount > 0}
          <Separator data-testid="prompt-folder-settings-toolbar-separator" />
        {/if}

        <div class="prompt-folder-editor-sections">
          {#each PROMPT_FOLDER_SETTINGS_FIELDS.filter(
            (field) => folderSettings[field] !== null
          ) as field, index (field)}
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
              value={folderSettings[field]!}
              focusAfterAdd={focusAfterAddField === field}
              onFocusAfterAddComplete={() => {
                focusAfterAddField = null
              }}
              onDeleteRequestChange={handleDeleteRequestChange}
              onHydrationChange={handleSectionHydrationChange}
              showTopBorder={index > 0}
              {onSettingsFieldChange}
              {onSettingsFieldPresenceChange}
            />
          {/each}
        </div>
      </div>
    {/if}
  </EditorCardSurface>
</div>

<style>
  .prompt-folder-editor-row {
    box-sizing: border-box;
    min-width: 0;
  }

  :global(.prompt-folder-top-cap.editor-card-surface) {
    border-color: var(--ui-card-nested-border);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
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
    align-items: baseline;
    display: flex;
    gap: 7px;
    min-width: 0;
  }

  .prompt-folder-editor-title {
    color: var(--ui-normal-text);
    font-size: 16px;
    font-weight: 700;
    line-height: 20px;
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
    .prompt-folder-editor-chevron-toggle[aria-expanded='true'] .prompt-folder-editor-chevron
  ) {
    transform: rotate(90deg);
  }

  .prompt-folder-editor-settings,
  .prompt-folder-editor-sections {
    background: var(--ui-editor-normal-surface);
    display: grid;
    min-width: 0;
  }

  .prompt-folder-settings-toolbar {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    gap: 24px;
    justify-content: space-between;
    min-width: 0;
    padding: 10px 12px 10px 16px;
  }

  .prompt-folder-settings-heading {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 14px;
    font-weight: 700;
    gap: 12px;
    min-width: 0;
  }

  .prompt-folder-settings-heading :global(svg) {
    color: var(--ui-secondary-icon-glyph);
  }

  .prompt-folder-settings-heading-copy {
    display: grid;
    line-height: 16px;
    min-width: 0;
    row-gap: 2px;
  }

  .prompt-folder-settings-metadata {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: 400;
  }

  .prompt-folder-settings-toggles {
    align-items: center;
    display: flex;
    flex: 0 1 auto;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
  }
</style>
