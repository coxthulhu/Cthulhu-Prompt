<script lang="ts">
  import { ChevronRight, Folder, FolderCog, Pencil } from 'lucide-svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/IconButtonBar.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import type { PromptFolderContentKind } from '@shared/PromptFolder'
  import EditorCardSurface from '../prompt-editor/EditorCardSurface.svelte'
  import type { DraggableOptions } from '../drag-drop/dragDrop.svelte.ts'
  import type {
    CategoryDragPayload,
    CategoryDropPayload
  } from '../drag-drop/promptHandleDrag'
  import CategoryEditorSidebar from './CategoryEditorSidebar.svelte'
  import { CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX } from './categoryEditorSizing'

  /** Inputs and callbacks for one category navigation card. */
  type Props = {
    categoryId: string
    displayName: string
    contentCount: number
    contentKind: PromptFolderContentKind
    rowHeightPx: number
    isContentSectionExpanded: boolean
    isReadOnly?: boolean
    canRename?: boolean
    showSidebar?: boolean
    dragOptions?: DraggableOptions<CategoryDragPayload, CategoryDropPayload>
    onContentSectionToggle: () => void
    onManageCategory: (focusName: boolean) => void
  }

  /** Reactive category-row inputs supplied by the virtualized prompt-folder screen. */
  let {
    categoryId,
    displayName,
    contentCount,
    contentKind,
    rowHeightPx: virtualRowHeightPx,
    isContentSectionExpanded,
    isReadOnly = false,
    canRename = !isReadOnly,
    showSidebar = false,
    dragOptions,
    onContentSectionToggle,
    onManageCategory
  }: Props = $props()

  /** Singular content label used by category metadata and controls. */
  const contentName = $derived(contentKind === 'template' ? 'template' : 'prompt')
  /** Human-readable category content count. */
  const contentCountLabel = $derived(
    `${contentCount} ${contentCount === 1 ? contentName : `${contentName}s`}`
  )
  /** Nonnegative rendered category-card height. */
  const cardHeightPx = $derived(Math.max(0, virtualRowHeightPx))

  /** Opens category management from a row action without activating the title bar. */
  const handleManageClick = (event: MouseEvent, focusName: boolean): void => {
    event.stopPropagation()
    onManageCategory(focusName)
  }

  /** Stops row-action presses from activating the category title bar. */
  const handleActionMouseDown = (event: MouseEvent): void => {
    event.stopPropagation()
  }
</script>

<!-- Category navigation row with management actions delegated to the modal dialog. -->
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

        <IconCell icon={Folder} variant="title" />

        <div class="category-editor-title-copy">
          <div class="category-editor-title-line">
            <!-- Category titles are explicitly excluded from default line heights. -->
            <span class="category-editor-title text-base leading-5" title={displayName}>
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
                onclick={(event) => handleManageClick(event, true)}
                onmousedown={handleActionMouseDown}
              />
            {/if}
          </div>

          <div class="category-editor-metadata-row text-xs">
            <span>{contentCountLabel}</span>
          </div>
        </div>
      </div>

      {#if !isReadOnly}
        <IconButtonBar>
          <IconButton
            icon={FolderCog}
            label="Manage category"
            title="Manage category"
            hoverVariant="accent"
            testId="category-editor-manage-button"
            onclick={(event) => handleManageClick(event, false)}
            onmousedown={handleActionMouseDown}
          />
        </IconButtonBar>
      {/if}
    </header>
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
    font-weight: var(--font-weight-semibold);
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
    gap: 8px;
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
</style>
