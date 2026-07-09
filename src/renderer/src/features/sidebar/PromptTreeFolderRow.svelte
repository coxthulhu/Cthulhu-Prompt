<script lang="ts">
  import { ArrowRight, MoreHorizontal, Settings } from 'lucide-svelte'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/DropdownPopupSimple.svelte'
  import RotatingChevron from '@renderer/common/cthulhu-ui/RotatingChevron.svelte'
  import type { PromptFolder } from '@shared/PromptFolder'
  import PromptTreeGutter from './PromptTreeGutter.svelte'
  import {
    folderOpenTestId,
    folderOptionsTestId,
    folderSettingsTestId,
    folderToggleTestId
  } from './promptTreeTestIds'
  import type { PromptRowDropOptions } from './promptTreeRowOptions'

  type Props = {
    folder: PromptFolder
    isActive: boolean
    isSettingsActive: boolean
    isPromptDragActive: boolean
    isExpanded: boolean
    indentCount?: number
    isLastRow?: boolean
    getFolderPromptDroppableOptions?: () => PromptRowDropOptions
    onFolderExpandedChange: (folderId: string, isExpanded: boolean) => void
    onPromptFolderOpen: (folderId: string) => void
    onFolderSettingsOpen: (folderId: string) => void
  }

  let {
    folder,
    isActive,
    isSettingsActive,
    isPromptDragActive,
    isExpanded,
    indentCount = 0,
    isLastRow = false,
    getFolderPromptDroppableOptions,
    onFolderExpandedChange,
    onPromptFolderOpen,
    onFolderSettingsOpen
  }: Props = $props()

  const PROMPT_TREE_INDENT_WIDTH_PX = 12
  const rowStyle = $derived(
    `--prompt-tree-indent-count:${indentCount}; --prompt-tree-indent-width:${PROMPT_TREE_INDENT_WIDTH_PX}px;`
  )

  const blurButtonAfterMouseClick = (event: MouseEvent) => {
    // Side effect: keep action-slot visibility stable by defocusing only real mouse clicks.
    const button = event.currentTarget
    if (event.detail !== 0 && button instanceof HTMLButtonElement) {
      button.blur()
    }
  }

  const handleFolderToggleClick = (event: MouseEvent) => {
    onFolderExpandedChange(folder.id, !isExpanded)
    blurButtonAfterMouseClick(event)
  }

  const handlePromptFolderOpen = (event: MouseEvent) => {
    onPromptFolderOpen(folder.id)
    blurButtonAfterMouseClick(event)
  }

  const dropdownItems = $derived.by((): DropdownPopupItem[] => [
    {
      id: 'folder-settings',
      label: 'Open folder settings',
      icon: Settings,
      testId: folderSettingsTestId(folder)
    }
    /*
    Show more/show less is paused until prompt tree subfolders reuse this folder row.
    ...(isExpanded && folder.promptCount > visiblePromptLimit
      ? [
          isShowingAllPrompts
            ? {
                id: 'show-less-prompts',
                label: 'Show less prompts',
                icon: ChevronsUp,
                testId: folderPromptMenuShowLessTestId(folder)
              }
            : {
                id: 'show-all-prompts',
                label: 'Show all prompts',
                icon: ChevronsDown,
                testId: folderPromptMenuShowAllTestId(folder)
              }
        ]
      : [])
    */
  ])

  const handleFolderOptionsSelect = (item: DropdownPopupItem, event: MouseEvent) => {
    if (item.id === 'folder-settings') {
      onFolderSettingsOpen(folder.id)
      blurButtonAfterMouseClick(event)
      return
    }

    /*
    if (item.id === 'show-all-prompts' || item.id === 'show-less-prompts') {
      onPromptVisibilityChange?.(folder.id, item.id === 'show-all-prompts')
      blurButtonAfterMouseClick(event)
    }
    */
  }
</script>

{#snippet folderRowContent(isOver: boolean)}
  {@const rowState = isOver
    ? 'over'
    : isActive
      ? isPromptDragActive
        ? 'drag-active'
        : 'active'
      : isPromptDragActive
        ? 'drag-idle'
        : 'idle'}
    <div
      class="sidebarPromptTreeRow group"
      data-row-state={rowState}
    >
      <button
        type="button"
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.displayName}`}
        aria-expanded={isExpanded}
        onclick={handleFolderToggleClick}
        data-testid={folderToggleTestId(folder)}
        class="sidebarPromptTreeToggleButton"
      >
        {#if indentCount > 0}
          <PromptTreeGutter {indentCount} {isLastRow} />
        {/if}
        <RotatingChevron
          expanded={isExpanded}
          size={24}
          iconSize={20}
          class="sidebarPromptTreeChevronWrap"
        />
        <span class="sidebarPromptTreeFolderLabel">{folder.displayName}</span>
      </button>

      <div class="sidebarPromptTreeActionSlot">
        <div class="sidebarPromptTreeFolderActions">
          <DropdownPopupSimple
            label={`Folder options for ${folder.displayName}`}
            items={dropdownItems}
            menuWidth="196px"
            onselect={handleFolderOptionsSelect}
          >
            {#snippet trigger(dropdown)}
              <IconButton
                icon={MoreHorizontal}
                label={`Folder options for ${folder.displayName}`}
                title="Folder Options"
                size="compact"
                active={dropdown.open || isSettingsActive}
                ariaHaspopup={dropdown.ariaHaspopup}
                ariaExpanded={dropdown.ariaExpanded}
                ariaCurrent={isSettingsActive ? 'true' : undefined}
                buttonAction={dropdown.triggerAction}
                onclick={dropdown.toggle}
                testId={folderOptionsTestId(folder)}
                class="sidebarPromptTreeActionButton"
              />
            {/snippet}
          </DropdownPopupSimple>
          <IconButton
            icon={ArrowRight}
            label={`Open ${folder.displayName}`}
            size="compact"
            onclick={handlePromptFolderOpen}
            testId={folderOpenTestId(folder)}
            active={isActive}
            class="sidebarPromptTreeActionButton"
          />
        </div>
      </div>
    </div>
{/snippet}

{#if getFolderPromptDroppableOptions}
  <PromptDropTarget
    getOptions={getFolderPromptDroppableOptions}
    class="sidebarPromptTreeFolderRow"
    style={rowStyle}
    data-indented={indentCount > 0 ? 'true' : undefined}
  >
    {#snippet children({ isOver })}
      {@render folderRowContent(isOver)}
    {/snippet}
  </PromptDropTarget>
{:else}
  <div
    class="sidebarPromptTreeFolderRow"
    style={rowStyle}
    data-indented={indentCount > 0 ? 'true' : undefined}
  >
    {@render folderRowContent(false)}
  </div>
{/if}
