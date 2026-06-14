<script lang="ts">
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import InlineTextButton from '@renderer/common/cthulhu-ui/InlineTextButton.svelte'
  import type { PromptFolder } from '@shared/PromptFolder'
  import PromptTreeGutter from './PromptTreeGutter.svelte'
  import { folderPromptShowAllTestId, folderPromptShowLessTestId } from './promptTreeTestIds'
  import type { PromptRowDropOptions } from './promptTreeRowOptions'

  type Props = {
    folder: PromptFolder
    isShowingAll: boolean
    isPromptDragActive: boolean
    hiddenPromptCount: number
    getVisibilityDroppableOptions: () => PromptRowDropOptions
    onPromptVisibilityChange: (folderId: string, isShowingAllPrompts: boolean) => void
  }

  let {
    folder,
    isShowingAll,
    isPromptDragActive,
    hiddenPromptCount,
    getVisibilityDroppableOptions,
    onPromptVisibilityChange
  }: Props = $props()

  const testId = $derived(
    isShowingAll ? folderPromptShowLessTestId(folder) : folderPromptShowAllTestId(folder)
  )
  const buttonText = $derived(isShowingAll ? 'Show less' : `Show all (${hiddenPromptCount} more)`)
  const rowState = $derived(isPromptDragActive ? 'drag-idle' : 'idle')

  const handleVisibilityClick = (event: MouseEvent) => {
    onPromptVisibilityChange(folder.id, !isShowingAll)

    const button = event.currentTarget
    if (button instanceof HTMLElement) {
      button.blur()
    }
  }
</script>

<PromptDropTarget getOptions={getVisibilityDroppableOptions} class="sidebarPromptTreeVisibilityRow">
  <PromptTreeGutter />
  <div class="sidebarPromptTreeVisibilityButtonWrap">
    <InlineTextButton
      text={buttonText}
      {rowState}
      {testId}
      onclick={handleVisibilityClick}
      class="sidebarPromptTreeVisibilityButton"
    />
  </div>
</PromptDropTarget>
