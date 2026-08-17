<script lang="ts">
  import { ArrowRight, Folder, Settings } from 'lucide-svelte'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/DropdownPopupSimple.svelte'
  import RotatingChevron from '@renderer/common/cthulhu-ui/RotatingChevron.svelte'
  import type { Category } from '@shared/Category'
  import type { Action } from 'svelte/action'
  import { draggable, type DraggableOptions } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import type {
    CategoryDragPayload,
    PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import PromptTreeGutter from './PromptTreeGutter.svelte'
  import {
    categoryOpenTestId,
    categorySettingsTestId,
    categoryToggleTestId
  } from './promptTreeTestIds'
  import type { PromptRowDropOptions } from './promptTreeRowOptions'

  /** Inputs and callbacks for one category in the prompt sidebar tree. */
  type Props = {
    category: Category
    isActive: boolean
    isDragging: boolean
    isPromptDragActive: boolean
    showDropOverHighlight?: boolean
    isExpanded: boolean
    indentCount?: number
    endsVisibleBranch?: boolean
    showActions?: boolean
    // Gives picker reuse rounded rows without changing the sidebar tree.
    roundedCorners?: boolean
    getCategoryContentDroppableOptions?: () => PromptRowDropOptions
    categoryDragOptions?: DraggableOptions<CategoryDragPayload, PromptHandleDropPayload>
    onCategoryExpandedChange: (categoryId: string, isExpanded: boolean) => void
    onCategoryOpen: (categoryId: string) => void
    onCategorySettingsOpen: (categoryId: string) => void
  }

  let {
    category,
    isActive,
    isDragging,
    isPromptDragActive,
    showDropOverHighlight = true,
    isExpanded,
    indentCount = 0,
    endsVisibleBranch = false,
    showActions = true,
    roundedCorners = false,
    getCategoryContentDroppableOptions,
    categoryDragOptions,
    onCategoryExpandedChange,
    onCategoryOpen,
    onCategorySettingsOpen
  }: Props = $props()

  /** Width of one prompt-tree indentation level. */
  const PROMPT_TREE_INDENT_WIDTH_PX = 12
  /** Inline indentation variables for this category row. */
  const rowStyle = $derived(
    `--prompt-tree-indent-count:${indentCount}; --prompt-tree-indent-width:${PROMPT_TREE_INDENT_WIDTH_PX}px;`
  )

  /** Removes mouse focus after category actions while preserving keyboard focus. */
  const blurButtonAfterMouseClick = (event: MouseEvent) => {
    // Side effect: keep action-slot visibility stable by defocusing only real mouse clicks.
    const button = event.currentTarget
    if (event.detail !== 0 && button instanceof HTMLButtonElement) {
      button.blur()
    }
  }

  /** Toggles the category's content rows. */
  const handleCategoryToggleClick = (event: MouseEvent) => {
    onCategoryExpandedChange(category.id, !isExpanded)
    blurButtonAfterMouseClick(event)
  }

  /** Opens the category card without automatically expanding its details. */
  const handleCategoryOpen = (event: MouseEvent) => {
    onCategoryOpen(category.id)
    blurButtonAfterMouseClick(event)
  }

  // Replaces the native browser context menu with this category's options at the cursor.
  const handleCategoryContextMenu = (
    event: MouseEvent,
    openAt: (event: MouseEvent) => void
  ): void => {
    event.preventDefault()

    if (event.button !== 2) {
      return
    }

    openAt(event)
  }

  /** Context-menu actions available for this category. */
  const dropdownItems = $derived.by((): DropdownPopupItem[] => [
    {
      id: 'category-settings',
      label: 'Open Category Settings',
      icon: Settings,
      testId: categorySettingsTestId(category)
    }
    /*
    Show more/show less remains disabled for category rows.
    ...(isExpanded && category.promptCount > visiblePromptLimit
      ? [
          isShowingAllPrompts
            ? {
                id: 'show-less-prompts',
                label: 'Show less prompts',
                icon: ChevronsUp,
                testId: categoryPromptMenuShowLessTestId(category)
              }
            : {
                id: 'show-all-prompts',
                label: 'Show all prompts',
                icon: ChevronsDown,
                testId: categoryPromptMenuShowAllTestId(category)
              }
        ]
      : [])
    */
  ])

  /** Handles a category context-menu selection. */
  const handleCategoryOptionsSelect = (item: DropdownPopupItem, event: MouseEvent) => {
    if (item.id === 'category-settings') {
      onCategorySettingsOpen(category.id)
      blurButtonAfterMouseClick(event)
      return
    }

    /*
    if (item.id === 'show-all-prompts' || item.id === 'show-less-prompts') {
      onPromptVisibilityChange?.(category.id, item.id === 'show-all-prompts')
      blurButtonAfterMouseClick(event)
    }
    */
  }

  /** Enables category dragging only when drag options are supplied. */
  const optionalCategoryDraggable: Action<
    HTMLButtonElement,
    DraggableOptions<CategoryDragPayload, PromptHandleDropPayload> | undefined
  > = (node, initialOptions) => {
    let action = initialOptions ? draggable(node, initialOptions) : null
    return {
      update(nextOptions) {
        if (!nextOptions) {
          action?.destroy()
          action = null
        } else if (action) {
          action.update(nextOptions)
        } else {
          action = draggable(node, nextOptions)
        }
      },
      destroy() {
        action?.destroy()
      }
    }
  }
</script>

{#snippet categoryRowChildren()}
  <button
    use:optionalCategoryDraggable={categoryDragOptions}
    type="button"
    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} category ${category.displayName}`}
    aria-expanded={isExpanded}
    onclick={handleCategoryToggleClick}
    data-testid={categoryToggleTestId(category)}
    class="sidebarPromptTreeToggleButton"
  >
    {#if indentCount > 0}
      <PromptTreeGutter {indentCount} isLastRow={endsVisibleBranch} />
    {/if}
    <RotatingChevron
      expanded={isExpanded}
      size={24}
      iconSize={20}
      class="sidebarPromptTreeChevronWrap"
    />
    <Folder class="sidebarPromptTreeCategoryIcon" size={16} aria-hidden="true" />
    <span class="sidebarPromptTreeCategoryLabel">{category.displayName}</span>
  </button>

  {#if showActions}
    <div class="sidebarPromptTreeActionSlot">
      <div class="sidebarPromptTreeCategoryActions">
        <IconButton
          icon={ArrowRight}
          label={`Open category ${category.displayName}`}
          size="compact"
          borderless
          onclick={handleCategoryOpen}
          testId={categoryOpenTestId(category)}
          active={isActive}
          class="sidebarPromptTreeActionButton"
        />
      </div>
    </div>
  {/if}
{/snippet}

{#snippet categoryRowContent(isOver: boolean)}
  {@const rowState = isDragging
    ? 'dragging'
    : isOver && showDropOverHighlight
      ? 'over'
      : isActive
        ? isPromptDragActive
          ? 'drag-active'
          : 'active'
        : isPromptDragActive
          ? 'drag-idle'
          : 'idle'}
  {#if showActions}
    <DropdownPopupSimple
      label={`Category options for ${category.displayName}`}
      items={dropdownItems}
      menuWidth="196px"
      onselect={handleCategoryOptionsSelect}
    >
      {#snippet trigger(dropdown)}
        <div
          use:dropdown.triggerAction
          role="group"
          class="sidebarPromptTreeRow group"
          data-row-state={rowState}
          data-rounded-corners={roundedCorners ? 'true' : undefined}
          oncontextmenu={(event) => handleCategoryContextMenu(event, dropdown.openAt)}
        >
          {@render categoryRowChildren()}
        </div>
      {/snippet}
    </DropdownPopupSimple>
  {:else}
    <div
      class="sidebarPromptTreeRow group"
      data-row-state={rowState}
      data-rounded-corners={roundedCorners ? 'true' : undefined}
    >
      {@render categoryRowChildren()}
    </div>
  {/if}
{/snippet}

{#if getCategoryContentDroppableOptions}
  <PromptDropTarget
    getOptions={getCategoryContentDroppableOptions}
    class="sidebarPromptTreeCategoryRow"
    style={rowStyle}
    data-indented={indentCount > 0 ? 'true' : undefined}
  >
    {#snippet children({ isOver })}
      {@render categoryRowContent(isOver)}
    {/snippet}
  </PromptDropTarget>
{:else}
  <div
    class="sidebarPromptTreeCategoryRow"
    style={rowStyle}
    data-indented={indentCount > 0 ? 'true' : undefined}
  >
    {@render categoryRowContent(false)}
  </div>
{/if}

<style>
  .sidebarPromptTreeRow[data-rounded-corners='true'],
  .sidebarPromptTreeRow[data-rounded-corners='true'] .sidebarPromptTreeToggleButton {
    border-radius: var(--cthulhu-ui-radius-control);
  }

  .sidebarPromptTreeRow[data-rounded-corners='true'] .sidebarPromptTreeToggleButton {
    cursor: pointer;
  }
</style>
