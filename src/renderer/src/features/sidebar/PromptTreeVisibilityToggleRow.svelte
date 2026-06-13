<script lang="ts">
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import InlineTextButton from '@renderer/common/cthulhu-ui/InlineTextButton.svelte'
  import type { PromptFolder } from '@shared/PromptFolder'
  import PromptTreeIndent from './PromptTreeIndent.svelte'
  import { folderPromptShowAllTestId, folderPromptShowLessTestId } from './promptTreeTestIds'
  import type { PromptRowDropOptions } from './promptTreeRowOptions'

  type Props = {
    folder: PromptFolder
    isShowingAll: boolean
    hiddenPromptCount: number
    getVisibilityDroppableOptions: () => PromptRowDropOptions
    onPromptVisibilityChange: (folderId: string, isShowingAllPrompts: boolean) => void
  }

  let {
    folder,
    isShowingAll,
    hiddenPromptCount,
    getVisibilityDroppableOptions,
    onPromptVisibilityChange
  }: Props = $props()

  const testId = $derived(
    isShowingAll ? folderPromptShowLessTestId(folder) : folderPromptShowAllTestId(folder)
  )
  const buttonText = $derived(
    isShowingAll ? 'Show less' : `Show all (${hiddenPromptCount} more)`
  )

  const handleVisibilityClick = (event: MouseEvent) => {
    onPromptVisibilityChange(folder.id, !isShowingAll)

    const button = event.currentTarget
    if (button instanceof HTMLElement) {
      button.blur()
    }
  }
</script>

<PromptDropTarget
  getOptions={getVisibilityDroppableOptions}
  class="sidebarPromptTreeVisibilityRow"
>
  <PromptTreeIndent />
  <div class="sidebarPromptTreeVisibilityButtonWrap">
    <InlineTextButton
      text={buttonText}
      {testId}
      onclick={handleVisibilityClick}
      class="sidebarPromptTreeVisibilityButton"
    />
  </div>
</PromptDropTarget>
