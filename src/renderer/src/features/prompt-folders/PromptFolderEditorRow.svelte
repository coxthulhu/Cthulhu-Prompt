<script lang="ts">
  import { Folder, Pencil, Settings } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import RotatingChevron from '@renderer/common/cthulhu-ui/RotatingChevron.svelte'
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
  import {
    PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX,
    PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX
  } from './promptFolderSettingsSizing'

  type Props = {
    workspaceId: string | null
    promptFolderId: string
    folderDisplayName: string
    promptCount: number
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
    isSettingsSectionExpanded: boolean
    isPromptsSectionExpanded: boolean
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
    isSettingsSectionExpanded,
    isPromptsSectionExpanded,
    onHydrationChange,
    onSettingsSectionToggle,
    onPromptsSectionToggle,
    onRenamePromptFolder,
    onSettingsFieldChange
  }: Props = $props()

  const promptCountLabel = $derived(`${promptCount} ${promptCount === 1 ? 'prompt' : 'prompts'}`)
  const cardHeightPx = $derived(
    Math.max(0, virtualRowHeightPx - PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX)
  )
  const hydratedFields = $state<Record<PromptFolderSettingsField, boolean>>({
    folderDescription: false,
    folderPrefix: false,
    folderSuffix: false
  })
  const isAnySectionHydrated = $derived(
    PROMPT_FOLDER_SETTINGS_FIELDS.some((field) => hydratedFields[field])
  )
  let lastReportedHydration = $state<boolean | null>(null)

  const handleTitleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onPromptsSectionToggle()
  }

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
    if (isSettingsSectionExpanded) return
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
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px; padding-top:${PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX}px;`}
  data-testid={`prompt-folder-editor-${promptFolderId}`}
  data-virtual-window-row
>
  <EditorCardSurface
    showSidebar={false}
    style={`height:${cardHeightPx}px; min-height:${cardHeightPx}px; max-height:${cardHeightPx}px;`}
  >
    <header
      class="prompt-folder-editor-title-bar"
      style={`height:${PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX}px; min-height:${PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX}px; max-height:${PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
      role="button"
      tabindex="0"
      aria-expanded={isPromptsSectionExpanded}
      data-testid="prompt-folder-editor-title-toggle"
      onclick={onPromptsSectionToggle}
      onkeydown={handleTitleKeydown}
    >
      <div class="prompt-folder-editor-title-main">
        <RotatingChevron
          expanded={isPromptsSectionExpanded}
          size={24}
          iconSize={18}
          class="prompt-folder-editor-chevron"
        />

        <IconCell icon={Folder} size="title" />

        <div class="prompt-folder-editor-title-copy">
          <div class="prompt-folder-editor-title-line">
            <span class="prompt-folder-editor-title" title={folderDisplayName}>
              {folderDisplayName}
            </span>
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
          </div>

          <div class="prompt-folder-editor-metadata-row">
            <span>{promptCountLabel}</span>
          </div>
        </div>
      </div>

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
    </header>

    <Separator />

    {#if isSettingsSectionExpanded}
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
    cursor: pointer;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    outline: none;
    overflow: hidden;
    padding: 8px 16px;
    user-select: none;
    -webkit-user-select: none;
  }

  .prompt-folder-editor-title-bar:focus-visible {
    box-shadow: inset 0 0 0 2px var(--ui-neutral-focus-border);
  }

  .prompt-folder-editor-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 24px 40px minmax(0, 1fr);
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

  .prompt-folder-editor-sections {
    background: var(--ui-editor-normal-surface);
    display: grid;
    min-width: 0;
  }
</style>
