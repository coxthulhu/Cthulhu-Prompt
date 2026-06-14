<script lang="ts">
  import { draggable } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import PromptTreeGutter from './PromptTreeGutter.svelte'
  import { folderPromptTestId } from './promptTreeTestIds'
  import type { PromptRowDragOptions, PromptRowDropOptions } from './promptTreeRowOptions'

  type Props = {
    folderId: string
    promptId: string
    promptTitle: string
    isActive: boolean
    isDragging: boolean
    isPromptDragActive: boolean
    getPromptDroppableOptions: () => PromptRowDropOptions
    promptDragOptions: PromptRowDragOptions
    onPromptSelect: (folderId: string, promptId: string) => void
  }

  let {
    folderId,
    promptId,
    promptTitle,
    isActive,
    isDragging,
    isPromptDragActive,
    getPromptDroppableOptions,
    promptDragOptions,
    onPromptSelect
  }: Props = $props()

  const handlePromptSelect = (event: MouseEvent) => {
    onPromptSelect(folderId, promptId)

    const button = event.currentTarget
    if (button instanceof HTMLButtonElement) {
      button.blur()
    }
  }

  const rowState = $derived(
    isDragging
      ? 'dragging'
      : isActive
        ? isPromptDragActive
          ? 'drag-active'
          : 'active'
        : isPromptDragActive
          ? 'drag-idle'
          : 'idle'
  )
</script>

<PromptDropTarget getOptions={getPromptDroppableOptions} class="sidebarPromptTreeSettingsRow">
  <PromptTreeGutter />
  <button
    use:draggable={promptDragOptions}
    type="button"
    data-testid={folderPromptTestId(promptId)}
    data-row-state={rowState}
    aria-current={isActive ? 'true' : undefined}
    onclick={handlePromptSelect}
    class="sidebarPromptTreeSettingsButton"
  >
    <span class="sidebarPromptTreeSettingsLabel">{promptTitle}</span>
  </button>
</PromptDropTarget>
