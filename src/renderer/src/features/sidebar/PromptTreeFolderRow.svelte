<script lang="ts">
  import {
    ArrowRight,
    ChevronsDown,
    ChevronsUp,
    MoreHorizontal,
    Settings
  } from 'lucide-svelte'
  import { draggable } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/DropdownPopupSimple.svelte'
  import RotatingChevron from '@renderer/common/cthulhu-ui/RotatingChevron.svelte'
  import type { PromptFolder } from '@shared/PromptFolder'
  import {
    folderOpenTestId,
    folderOptionsTestId,
    folderPromptMenuShowAllTestId,
    folderPromptMenuShowLessTestId,
    folderSettingsTestId,
    folderToggleTestId
  } from './promptTreeTestIds'
  import type {
    FolderRowDragOptions,
    FolderRowDropOptions,
    PromptRowDropOptions
  } from './promptTreeRowOptions'

  type Props = {
    folder: PromptFolder
    isActive: boolean
    isSettingsActive: boolean
    isExpanded: boolean
    isShowingAllPrompts: boolean
    visiblePromptLimit: number
    getFolderRowDroppableOptions: () => FolderRowDropOptions
    getFolderPromptDroppableOptions: () => PromptRowDropOptions
    folderDragOptions: FolderRowDragOptions
    onFolderExpandedChange: (folderId: string, isExpanded: boolean) => void
    onPromptFolderOpen: (folderId: string) => void
    onFolderSettingsOpen: (folderId: string) => void
    onPromptVisibilityChange: (folderId: string, isShowingAllPrompts: boolean) => void
  }

  let {
    folder,
    isActive,
    isSettingsActive,
    isExpanded,
    isShowingAllPrompts,
    visiblePromptLimit,
    getFolderRowDroppableOptions,
    getFolderPromptDroppableOptions,
    folderDragOptions,
    onFolderExpandedChange,
    onPromptFolderOpen,
    onFolderSettingsOpen,
    onPromptVisibilityChange
  }: Props = $props()

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

  const handlePromptVisibilityMenuSelect = (isNextShowingAllPrompts: boolean, event: MouseEvent) => {
    onPromptVisibilityChange(folder.id, isNextShowingAllPrompts)
    blurButtonAfterMouseClick(event)
  }

  const dropdownItems = $derived.by(
    (): DropdownPopupItem[] => [
      {
        id: 'folder-settings',
        label: 'Open folder settings',
        icon: Settings,
        testId: folderSettingsTestId(folder)
      },
      ...(isExpanded && folder.promptIds.length > visiblePromptLimit
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
    ]
  )

  const handleFolderOptionsSelect = (item: DropdownPopupItem, event: MouseEvent) => {
    if (item.id === 'folder-settings') {
      onFolderSettingsOpen(folder.id)
      blurButtonAfterMouseClick(event)
      return
    }

    if (item.id === 'show-all-prompts' || item.id === 'show-less-prompts') {
      handlePromptVisibilityMenuSelect(item.id === 'show-all-prompts', event)
    }
  }
</script>

<PromptDropTarget
  getOptions={getFolderRowDroppableOptions}
  class="sidebarPromptTreeFolderRow"
>
  <PromptDropTarget getOptions={getFolderPromptDroppableOptions} class="w-full">
    {#snippet children({ isOver })}
      <div
        use:draggable={folderDragOptions}
        class="sidebarPromptTreeRow group"
        data-active={isActive ? 'true' : 'false'}
        data-over={isOver ? 'true' : 'false'}
      >
        <button
          type="button"
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.displayName}`}
          aria-expanded={isExpanded}
          onclick={handleFolderToggleClick}
          data-testid={folderToggleTestId(folder)}
          class="sidebarPromptTreeToggleButton"
        >
          <RotatingChevron
            expanded={isExpanded}
            size={20}
            iconSize={16}
            class="sidebarPromptTreeChevronWrap"
          />
          <span class="sidebarPromptTreeFolderLabel">{folder.displayName}</span>
        </button>

        <!-- Count and actions share one slot; hover/focus swaps visibility. -->
        <div class="sidebarPromptTreeActionSlot">
          <span class="sidebarPromptTreeCountBadge sidebarPromptTreeCountInActionSlot">
            {folder.promptIds.length}
          </span>
          <div class="sidebarPromptTreeFolderActions">
            <DropdownPopupSimple
              label={`Folder options for ${folder.displayName}`}
              items={dropdownItems}
              menuWidth="196px"
              onselect={handleFolderOptionsSelect}
            >
              {#snippet trigger(dropdown)}
                <IconOnlyButton
                  icon={MoreHorizontal}
                  label={`Folder options for ${folder.displayName}`}
                  title="Folder Options"
                  variant="transparent"
                  size="tree-action"
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
            <IconOnlyButton
              icon={ArrowRight}
              label={`Open ${folder.displayName}`}
              variant="transparent"
              size="tree-action"
              onclick={handlePromptFolderOpen}
              testId={folderOpenTestId(folder)}
              active={isActive}
              class="sidebarPromptTreeActionButton"
            />
          </div>
        </div>
      </div>
    {/snippet}
  </PromptDropTarget>
</PromptDropTarget>
