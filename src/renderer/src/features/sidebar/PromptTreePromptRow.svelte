<script lang="ts">
  import { Play } from 'lucide-svelte'
  import { draggable } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import { PromptStatus } from '@shared/Prompt'
  import PromptTreeGutter from './PromptTreeGutter.svelte'
  import { folderPromptTestId } from './promptTreeTestIds'
  import type { PromptRowDragOptions, PromptRowDropOptions } from './promptTreeRowOptions'

  type Props = {
    folderId: string
    promptId: string
    promptTitle: string
    status?: PromptStatus
    isActive: boolean
    isDragging: boolean
    isPromptDragActive: boolean
    indentCount?: number
    isLastRow?: boolean
    getPromptDroppableOptions?: () => PromptRowDropOptions
    promptDragOptions?: PromptRowDragOptions
    onPromptSelect: (folderId: string, promptId: string) => void
  }

  let {
    folderId,
    promptId,
    promptTitle,
    status,
    isActive,
    isDragging,
    isPromptDragActive,
    indentCount = 0,
    isLastRow = false,
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

{#snippet promptButtonContent()}
  <PromptTreeGutter indentCount={promptIndentCount} {isLastRow} />
  <span class="prompt-tree-prompt-content">
    <span class="sidebarPromptTreeSettingsLabel prompt-tree-prompt-label">{promptTitle}</span>
    {#if status === PromptStatus.InProgress}
      <span
        class="prompt-tree-in-progress-indicator"
        data-testid="prompt-tree-in-progress-indicator"
        role="img"
        aria-label="In Progress"
        title="In Progress"
      >
        <Play size={16} aria-hidden="true" />
      </span>
    {/if}
  </span>
{/snippet}

{#snippet promptButton()}
  <button
    type="button"
    data-testid={folderPromptTestId(promptId)}
    data-row-state={rowState}
    aria-current={isActive ? 'true' : undefined}
    onclick={handlePromptSelect}
    class="sidebarPromptTreeSettingsButton"
  >
    {@render promptButtonContent()}
  </button>
{/snippet}

{#if getPromptDroppableOptions && promptDragOptions}
  <PromptDropTarget
    getOptions={getPromptDroppableOptions}
    class="sidebarPromptTreeSettingsRow"
    style={rowStyle}
  >
    <button
      use:draggable={promptDragOptions}
      type="button"
      data-testid={folderPromptTestId(promptId)}
      data-row-state={rowState}
      aria-current={isActive ? 'true' : undefined}
      onclick={handlePromptSelect}
      class="sidebarPromptTreeSettingsButton"
    >
      {@render promptButtonContent()}
    </button>
  </PromptDropTarget>
{:else}
  <div class="sidebarPromptTreeSettingsRow" style={rowStyle}>
    {@render promptButton()}
  </div>
{/if}

<style>
  .prompt-tree-prompt-content {
    align-items: center;
    display: flex;
    gap: 8px;
    min-width: 0;
  }

  .prompt-tree-prompt-label {
    flex: 1 1 auto;
  }

  .prompt-tree-in-progress-indicator {
    color: var(--ui-warning-icon-glyph);
    display: inline-flex;
    flex: 0 0 auto;
  }
</style>
