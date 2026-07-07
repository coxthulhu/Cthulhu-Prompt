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
    indentCount?: number
    getPromptDroppableOptions?: () => PromptRowDropOptions
    promptDragOptions?: PromptRowDragOptions
    onPromptSelect: (folderId: string, promptId: string) => void
  }

  let {
    folderId,
    promptId,
    promptTitle,
    isActive,
    isDragging,
    isPromptDragActive,
    indentCount = 0,
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
  const promptIndentCount = $derived(indentCount)
  const PROMPT_TREE_INDENT_WIDTH_PX = 12
  const rowStyle = $derived(
    `--prompt-tree-indent-count:${promptIndentCount}; --prompt-tree-indent-width:${PROMPT_TREE_INDENT_WIDTH_PX}px;`
  )
</script>

{#snippet promptButton()}
  <button
    type="button"
    data-testid={folderPromptTestId(promptId)}
    data-row-state={rowState}
    aria-current={isActive ? 'true' : undefined}
    onclick={handlePromptSelect}
    class="sidebarPromptTreeSettingsButton"
  >
    <span class="sidebarPromptTreeSettingsLabel">{promptTitle}</span>
  </button>
{/snippet}

{#if getPromptDroppableOptions && promptDragOptions}
  <PromptDropTarget
    getOptions={getPromptDroppableOptions}
    class="sidebarPromptTreeSettingsRow"
    style={rowStyle}
  >
    <PromptTreeGutter indentCount={promptIndentCount} />
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
{:else}
  <div class="sidebarPromptTreeSettingsRow" style={rowStyle}>
    <PromptTreeGutter indentCount={promptIndentCount} />
    {@render promptButton()}
  </div>
{/if}
