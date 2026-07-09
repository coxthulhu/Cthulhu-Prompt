<script lang="ts">
  import { ArrowDownToLine, FolderPlus, Plus } from 'lucide-svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import type { DroppableOptions } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import type {
    PromptHandleDragPayload,
    PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { PROMPT_DIVIDER_ROW_HEIGHT_PX } from './promptDividerSizing'

  let {
    onAddPrompt,
    onAddSubfolder,
    mode = 'add',
    disabled = false,
    testId,
    subfolderTestId,
    getDropOptions
  }: {
    onAddPrompt?: () => void
    onAddSubfolder?: () => void
    mode?: 'add' | 'separator'
    disabled?: boolean
    testId?: string
    subfolderTestId?: string
    getDropOptions?: () => DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
  } = $props()
</script>

{#snippet dividerContent({ isOver = false } = {})}
  {@const DividerIcon = isOver ? ArrowDownToLine : Plus}
  {@const dividerText = isOver ? 'Move here' : 'Add Prompt'}
  <div
    class="promptDividerRow grid items-center"
    data-drop-over={isOver ? 'true' : 'false'}
    style={`height:${PROMPT_DIVIDER_ROW_HEIGHT_PX}px;`}
  >
    <div
      class={mode === 'separator'
        ? 'grid min-h-9 grid-cols-1 items-center'
        : 'promptDividerContent grid min-h-9 items-center'}
      data-has-subfolder={onAddSubfolder ? 'true' : undefined}
    >
      {#if mode === 'separator'}
        <!-- Completed mode uses the divider as a plain section separator. -->
        <Separator
          class={isOver
            ? '!h-2.5 rounded-full !bg-[var(--ui-info-strong-border)]'
            : 'bg-[var(--ui-neutral-muted-border)]'}
        />
      {:else if isOver}
        <div
          class="promptDividerMoveIndicator"
          data-drop-over="true"
          data-testid={testId}
          aria-label={dividerText}
        >
          <DividerIcon class="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
          <span>{dividerText}</span>
        </div>
      {:else}
        <div class="promptDividerActions">
          <IconButton
            icon={DividerIcon}
            label={dividerText}
            title={dividerText}
            disabled={disabled}
            hoverVariant="accent"
            {testId}
            onclick={() => {
              onAddPrompt?.()
            }}
          />
          {#if onAddSubfolder}
            <IconButton
              icon={FolderPlus}
              label="Add Subfolder"
              title="Add Subfolder"
              disabled={disabled}
              hoverVariant="accent"
              testId={subfolderTestId}
              onclick={() => {
                onAddSubfolder()
              }}
            />
          {/if}
        </div>
      {/if}
      {#if mode !== 'separator'}
        <Separator
          class={isOver
            ? '!h-2.5 rounded-full !bg-[var(--ui-info-strong-border)]'
            : 'bg-[var(--ui-neutral-muted-border)]'}
        />
      {/if}
    </div>
  </div>
{/snippet}

{#if getDropOptions}
  <PromptDropTarget getOptions={getDropOptions}>
    {#snippet children({ isOver })}
      {@render dividerContent({ isOver })}
    {/snippet}
  </PromptDropTarget>
{:else}
  {@render dividerContent()}
{/if}

<style>
  .promptDividerMoveIndicator {
    align-items: center;
    background: var(--ui-info-hover-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 13px;
    font-weight: 600;
    gap: 7px;
    height: 30px;
    justify-content: center;
    line-height: 16px;
    min-width: 96px;
    padding: 0 10px;
    white-space: nowrap;
    width: var(--prompt-divider-side-width);
  }

  .promptDividerContent {
    /* Mirror the action track and gap so the separator has equal side insets. */
    --prompt-divider-side-width: 36px;

    column-gap: 10px;
    grid-template-columns:
      var(--prompt-divider-side-width)
      minmax(24px, 1fr)
      var(--prompt-divider-side-width);
  }

  .promptDividerContent[data-has-subfolder='true'] {
    --prompt-divider-side-width: 76px;
  }

  .promptDividerRow[data-drop-over='true'] .promptDividerContent {
    --prompt-divider-side-width: 96px;
  }

  .promptDividerContent::after {
    content: '';
  }

  .promptDividerActions {
    /* Keep the action column reserved while its buttons fade out. */
    align-items: center;
    display: inline-flex;
    gap: 4px;
    min-width: 0;
    opacity: 0;
    transition: opacity 50ms ease-out;
  }

  .promptDividerRow:hover .promptDividerActions,
  .promptDividerRow:focus-within .promptDividerActions {
    opacity: 1;
  }
</style>
