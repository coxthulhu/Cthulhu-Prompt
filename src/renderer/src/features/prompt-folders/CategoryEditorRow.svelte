<script lang="ts">
  import { Check, ChevronRight, Folder, Pencil, Plus, Settings, Trash2 } from 'lucide-svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/IconButtonBar.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import type { PromptFolderContentKind } from '@shared/PromptFolder'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import EditorCardSurface from '../prompt-editor/EditorCardSurface.svelte'
  import EditorSubtitleBar from '../prompt-editor/EditorSubtitleBar.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import CategoryDescriptionEditorSection from './CategoryDescriptionEditorSection.svelte'
  import CategoryEditorSidebar from './CategoryEditorSidebar.svelte'
  import {
    droppable,
    type DraggableOptions,
    type DroppableOptions
  } from '../drag-drop/dragDrop.svelte.ts'
  import type {
    CategoryDragPayload,
    PromptHandleDropPayload,
    PromptTreeEntryDragPayload
  } from '../drag-drop/promptHandleDrag'
  import {
    CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX
  } from './categoryEditorSizing'

  /** Inputs and callbacks for one editable category card. */
  type Props = {
    workspaceId: string | null
    categoryId: string
    displayName: string
    contentCount: number
    description: string | null
    contentKind: PromptFolderContentKind
    rowId: string
    virtualWindowWidthPx: number
    devicePixelRatio: number
    rowHeightPx: number
    descriptionHeightPx: number
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    isDetailsSectionExpanded: boolean
    isContentSectionExpanded: boolean
    isReadOnly?: boolean
    canRename?: boolean
    showSidebar?: boolean
    dragOptions?: DraggableOptions<CategoryDragPayload, PromptHandleDropPayload>
    dropOptions?: DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload>
    onHydrationChange?: (isHydrated: boolean) => void
    onDetailsSectionToggle: () => void
    onContentSectionToggle: () => void
    onDeleteCategory: () => void
    onRenameCategory: () => void
    onDescriptionChange: (text: string, measurement: TextMeasurement) => void
    onDescriptionPresenceChange: (isPresent: boolean) => void
  }

  let {
    workspaceId,
    categoryId,
    displayName,
    contentCount,
    description,
    contentKind,
    rowId,
    virtualWindowWidthPx,
    devicePixelRatio,
    rowHeightPx: virtualRowHeightPx,
    descriptionHeightPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    scrollToWithinWindowBand,
    isDetailsSectionExpanded,
    isContentSectionExpanded,
    isReadOnly = false,
    canRename = !isReadOnly,
    showSidebar = false,
    dragOptions,
    dropOptions,
    onHydrationChange,
    onDetailsSectionToggle,
    onContentSectionToggle,
    onDeleteCategory,
    onRenameCategory,
    onDescriptionChange,
    onDescriptionPresenceChange
  }: Props = $props()

  /** Singular content label used by category metadata and controls. */
  const contentName = $derived(contentKind === 'template' ? 'template' : 'prompt')
  /** Human-readable category content count. */
  const contentCountLabel = $derived(
    `${contentCount} ${contentCount === 1 ? contentName : `${contentName}s`}`
  )
  /** Nonnegative rendered category-card height. */
  const cardHeightPx = $derived(Math.max(0, virtualRowHeightPx))
  /** Whether the category description Monaco instance is active. */
  let isDescriptionHydrated = $state(false)
  /** Number of configured category settings. */
  const configuredSettingsCount = $derived(description === null ? 0 : 1)
  /** Whether this row currently contains an editor that must hydrate. */
  const hasHydratableSection = $derived(
    isDetailsSectionExpanded && !isReadOnly && description !== null
  )
  /** Aggregate hydration state reported to the virtual window. */
  const isRowHydrated = $derived(!hasHydratableSection || isDescriptionHydrated)
  /** Inactive indicator required by the read-only title bar's disabled target. */
  const disabledDropIndicator = $state({ isOver: false, isBlocked: false, edge: null })
  /** Effective row drop options, including the disabled fallback. */
  const effectiveDropOptions = $derived<
    DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload>
  >(
    dropOptions ?? {
      dragType: 'disabled-prompt-folder-row',
      canDrop: () => false,
      indicator: disabledDropIndicator
    }
  )
  /** Last aggregate hydration value sent to the parent. */
  let lastReportedHydration = $state<boolean | null>(null)
  /** Requests focus after adding the category description setting. */
  let focusDescriptionAfterAdd = $state(false)
  /** Delete workflow exposed by the mounted category description editor. */
  let requestDescriptionDelete: (() => void) | null = null

  /** Opens category rename without allowing the title bar to handle the click. */
  const handlePencilClick = (event: MouseEvent) => {
    event.stopPropagation()
    onRenameCategory()
  }

  /** Stops rename-button presses from activating the category title bar. */
  const handlePencilMouseDown = (event: MouseEvent) => {
    event.stopPropagation()
  }

  /** Toggles category settings without activating the category title bar. */
  const handleSettingsClick = (event: MouseEvent) => {
    event.stopPropagation()
    onDetailsSectionToggle()
  }

  /** Stops settings-button presses from activating the category title bar. */
  const handleSettingsMouseDown = (event: MouseEvent) => {
    event.stopPropagation()
  }

  /** Requests category deletion without activating the title bar. */
  const handleDeleteClick = (event: MouseEvent) => {
    event.stopPropagation()
    onDeleteCategory()
  }

  /** Stops delete-button presses from activating the category title bar. */
  const handleDeleteMouseDown = (event: MouseEvent) => {
    event.stopPropagation()
  }

  /** Adds or requests removal of the category description. */
  const handleDescriptionToggle = () => {
    if (description !== null) {
      requestDescriptionDelete?.()
      return
    }

    focusDescriptionAfterAdd = true
    onDescriptionPresenceChange(true)
  }

  /** Receives the mounted description editor's delete workflow. */
  const handleDeleteRequestChange = (
    requestDelete: (() => void) | null
  ) => {
    requestDescriptionDelete = requestDelete
  }

  // Side effect: hidden settings sections are unmounted and no longer hydrate the virtual row.
  $effect(() => {
    if (isDetailsSectionExpanded && !isReadOnly) return
    isDescriptionHydrated = false
  })

  // Side effect: report aggregate row hydration to the virtual window.
  $effect(() => {
    if (lastReportedHydration === isRowHydrated) return
    lastReportedHydration = isRowHydrated
    onHydrationChange?.(isRowHydrated)
  })
</script>

<div
  class="category-editor-row"
  style={`height:${virtualRowHeightPx}px; min-height:${virtualRowHeightPx}px; max-height:${virtualRowHeightPx}px;`}
  data-testid={`category-editor-${categoryId}`}
  data-category-id={categoryId}
  data-virtual-window-row
>
  <EditorCardSurface
    {showSidebar}
    class="category-top-cap"
    style={`height:${cardHeightPx}px; min-height:${cardHeightPx}px; max-height:${cardHeightPx}px;`}
  >
    {#snippet sidebar()}
      {#if dragOptions}
        <CategoryEditorSidebar {dragOptions} />
      {/if}
    {/snippet}

    <header
      use:droppable={effectiveDropOptions}
      class="category-editor-title-bar"
      style={`height:${CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX}px; min-height:${CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX}px; max-height:${CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
      data-testid="category-editor-title-bar"
    >
      <div class="category-editor-title-main">
        <IconButton
          icon={ChevronRight}
          label={isContentSectionExpanded
            ? `Collapse category ${contentName}s`
            : `Expand category ${contentName}s`}
          title={isContentSectionExpanded
            ? `Collapse category ${contentName}s`
            : `Expand category ${contentName}s`}
          ariaExpanded={isContentSectionExpanded}
          iconSize={24}
          borderless
          class="category-editor-chevron-toggle"
          iconClass="category-editor-chevron"
          testId="category-editor-content-toggle"
          onclick={onContentSectionToggle}
        />

        <IconCell icon={Folder} size="title" />

        <div class="category-editor-title-copy">
          <div class="category-editor-title-line">
            <span class="category-editor-title" title={displayName}>
              {displayName}
            </span>
            {#if canRename && !isReadOnly}
              <IconButton
                icon={Pencil}
                label="Rename category"
                title="Rename category"
                size="tiny"
                baseVariant="muted"
                hoverVariant="glyph"
                testId="category-editor-title-edit"
                onclick={handlePencilClick}
                onmousedown={handlePencilMouseDown}
              />
            {/if}
          </div>

          <div class="category-editor-metadata-row">
            <span>{contentCountLabel}</span>
          </div>
        </div>
      </div>

      {#if !isReadOnly}
        <IconButtonBar>
          <IconButton
            icon={Settings}
            label={isDetailsSectionExpanded ? 'Hide category settings' : 'Show category settings'}
            title={isDetailsSectionExpanded ? 'Hide category settings' : 'Show category settings'}
            hoverVariant="accent"
            active={isDetailsSectionExpanded}
            ariaPressed={isDetailsSectionExpanded}
            testId="category-editor-settings-toggle"
            onclick={handleSettingsClick}
            onmousedown={handleSettingsMouseDown}
          />
          <IconButton
            icon={Trash2}
            label="Delete category"
            title="Delete category"
            hoverVariant="danger"
            testId="category-editor-delete-button"
            onclick={handleDeleteClick}
            onmousedown={handleDeleteMouseDown}
          />
        </IconButtonBar>
      {/if}
    </header>

    {#if isDetailsSectionExpanded && !isReadOnly}
      <Separator data-testid="category-editor-settings-separator" />

      <div class="category-editor-settings">
        <EditorSubtitleBar
          icon={Settings}
          title="Category Settings"
          configuredCount={configuredSettingsCount}
          totalCount={1}
          actionsLabel="Category settings"
          testId="category-settings-toolbar"
        >
          {#snippet actions()}
            <IconTextButton
              icon={Plus}
              pressedIcon={Check}
              pressedHoverIcon={Trash2}
              text="Description"
              pressed={description !== null}
              title={`${description !== null ? 'Remove' : 'Add'} category description`}
              testId="category-settings-toggle-description"
              onclick={handleDescriptionToggle}
            />
          {/snippet}
        </EditorSubtitleBar>

        {#if configuredSettingsCount > 0}
          <Separator data-testid="category-settings-toolbar-separator" />
        {/if}

        <div class="category-editor-sections">
          {#if description !== null}
            <CategoryDescriptionEditorSection
              {workspaceId}
              {categoryId}
              {rowId}
              {virtualWindowWidthPx}
              {devicePixelRatio}
              sectionHeightPx={descriptionHeightPx}
              {hydrationPriority}
              {shouldDehydrate}
              {overlayRowElement}
              {scrollToWithinWindowBand}
              value={description}
              focusAfterAdd={focusDescriptionAfterAdd}
              onFocusAfterAddComplete={() => {
                focusDescriptionAfterAdd = false
              }}
              onDeleteRequestChange={handleDeleteRequestChange}
              onHydrationChange={(isHydrated) => {
                isDescriptionHydrated = isHydrated
              }}
              {onDescriptionChange}
              {onDescriptionPresenceChange}
            />
          {/if}
        </div>
      </div>
    {/if}
  </EditorCardSurface>
</div>

<style>
  .category-editor-row {
    box-sizing: border-box;
    min-width: 0;
  }

  :global(.category-top-cap.editor-card-surface) {
    border-color: var(--ui-card-nested-border);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .category-editor-title-bar {
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

  .category-editor-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 30px 40px minmax(0, 1fr);
    min-width: 0;
  }

  .category-editor-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .category-editor-title-line {
    align-items: baseline;
    display: flex;
    gap: 7px;
    min-width: 0;
  }

  .category-editor-title {
    color: var(--ui-normal-text);
    font-size: 16px;
    font-weight: 700;
    line-height: 20px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .category-editor-metadata-row {
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

  :global(.category-editor-chevron-toggle.cthulhuUiIconButton) {
    height: 30px;
    width: 30px;
  }

  :global(.category-editor-chevron) {
    transform: rotate(0deg);
    transform-origin: center;
    transition: transform var(--ui-animation-duration-fast) ease-out;
  }

  :global(
    .category-editor-chevron-toggle[aria-expanded='true'] .category-editor-chevron
  ) {
    transform: rotate(90deg);
  }

  .category-editor-settings,
  .category-editor-sections {
    background: var(--ui-card-normal-surface);
    display: grid;
    min-width: 0;
  }

</style>
