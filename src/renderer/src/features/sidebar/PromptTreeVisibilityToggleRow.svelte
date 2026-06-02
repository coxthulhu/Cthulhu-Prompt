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
    getVisibilityDroppableOptions: () => PromptRowDropOptions
    onPromptVisibilityChange: (folderId: string, isShowingAllPrompts: boolean) => void
  }

  let {
    folder,
    isShowingAll,
    getVisibilityDroppableOptions,
    onPromptVisibilityChange
  }: Props = $props()

  const testId = $derived(
    isShowingAll ? folderPromptShowLessTestId(folder) : folderPromptShowAllTestId(folder)
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
      text={isShowingAll ? 'Show less' : 'Show all'}
      {testId}
      onclick={handleVisibilityClick}
      class="sidebarPromptTreeVisibilityButton"
    />
  </div>
</PromptDropTarget>
