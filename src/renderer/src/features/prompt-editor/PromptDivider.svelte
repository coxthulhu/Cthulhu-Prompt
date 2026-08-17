<script lang="ts">
  import { Plus } from 'lucide-svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import type { DroppableOptions } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import type {
    PromptHandleDragPayload,
    PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { PROMPT_DIVIDER_ROW_HEIGHT_PX } from './promptDividerSizing'

  let {
    onAddPrompt,
    mode = 'add',
    contentLabel = 'Prompt',
    disabled = false,
    testId,
    getDropOptions
  }: {
    onAddPrompt?: () => void
    mode?: 'add' | 'separator'
    contentLabel?: 'Prompt' | 'Template'
    disabled?: boolean
    testId?: string
    getDropOptions?: () => DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
  } = $props()
</script>

{#snippet dividerContent({ isOver = false } = {})}
  {@const dividerText = isOver ? 'Move Here' : `Add ${contentLabel}`}
  <div
    class="promptDividerRow grid items-center"
    data-drop-over={isOver ? 'true' : 'false'}
    style={`height:${PROMPT_DIVIDER_ROW_HEIGHT_PX}px;`}
  >
    <div
      class={mode === 'separator'
        ? 'grid h-full grid-cols-1 items-center'
        : 'promptDividerContent grid h-full items-center'}
    >
      {#if mode === 'separator'}
        <!-- Completed mode uses the divider as a plain section separator. -->
        <Separator
          class={isOver
            ? '!h-2.5 rounded-full !border-0 !bg-[var(--ui-info-strong-border)]'
            : undefined}
        />
      {:else if isOver}
        <Separator
          class="!h-2.5 rounded-full !border-0 !bg-[var(--ui-info-strong-border)]"
        />
        <div
          class="promptDividerMoveIndicator"
          data-drop-over="true"
          data-testid={testId}
          aria-label={dividerText}
        >
          <span>{dividerText}</span>
        </div>
        <Separator
          class="!h-2.5 rounded-full !border-0 !bg-[var(--ui-info-strong-border)]"
        />
      {:else}
        <!-- The centered line buttons limit separator clicks without moving the visible lines. -->
        <button
          class="promptDividerSeparatorButton"
          type="button"
          aria-label={`Add ${contentLabel} from left separator`}
          title={dividerText}
          {disabled}
          data-testid={testId ? `${testId}-separator-left` : undefined}
          onclick={() => {
            onAddPrompt?.()
          }}
        >
          <Separator />
        </button>
        <div class="promptDividerActions">
          <button
            class="promptDividerActionButton"
            type="button"
            aria-label={dividerText}
            title={dividerText}
            {disabled}
            data-testid={testId}
            onclick={() => {
              onAddPrompt?.()
            }}
          >
            <Plus size={13} aria-hidden="true" />
            <span>{dividerText}</span>
          </button>
        </div>
        <button
          class="promptDividerSeparatorButton"
          type="button"
          aria-label={`Add ${contentLabel} from right separator`}
          title={dividerText}
          {disabled}
          data-testid={testId ? `${testId}-separator-right` : undefined}
          onclick={() => {
            onAddPrompt?.()
          }}
        >
          <Separator />
        </button>
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
    font-size: 12px;
    font-weight: 600;
    height: 26px;
    justify-content: center;
    line-height: 16px;
    min-width: 96px;
    padding: 0 10px;
    white-space: nowrap;
  }

  .promptDividerContent {
    grid-template-columns: minmax(14px, 1fr) auto minmax(14px, 1fr);
  }

  .promptDividerRow[data-drop-over='true'] .promptDividerContent {
    grid-template-columns: minmax(24px, 1fr) auto minmax(24px, 1fr);
  }

  .promptDividerSeparatorButton {
    align-items: center;
    background: transparent;
    border: 0;
    cursor: pointer;
    display: flex;
    height: 12px;
    padding: 0 9px;
    width: 100%;
  }

  .promptDividerSeparatorButton:first-child {
    padding-left: 0;
  }

  .promptDividerSeparatorButton:last-child {
    padding-right: 0;
  }

  .promptDividerSeparatorButton:disabled {
    cursor: default;
  }

  .promptDividerSeparatorButton :global(.cthulhuUiSeparator) {
    transition: border-color var(--ui-animation-duration-standard) ease;
  }

  .promptDividerActions {
    align-items: center;
    display: inline-flex;
    gap: 20px;
    height: 100%;
    min-width: 0;
    opacity: 0;
    transition: opacity var(--ui-animation-duration-standard) ease;
  }

  .promptDividerActionButton {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-muted-text);
    cursor: pointer;
    display: inline-flex;
    font-size: 12px;
    gap: 4px;
    height: 100%;
    line-height: 16px;
    padding: 0;
    transition: color var(--ui-animation-duration-standard) ease;
    white-space: nowrap;
  }

  .promptDividerActionButton:disabled {
    cursor: default;
  }

  .promptDividerRow:hover .promptDividerActions,
  .promptDividerRow:focus-within .promptDividerActions {
    opacity: 1;
  }

  .promptDividerRow:hover .promptDividerActionButton,
  .promptDividerRow:focus-within .promptDividerActionButton {
    color: var(--ui-accent-normal-text);
  }

  .promptDividerContent:has(.promptDividerSeparatorButton:hover)
    .promptDividerSeparatorButton
    :global(.cthulhuUiSeparator),
  .promptDividerRow:has(
      .promptDividerSeparatorButton:focus-visible,
      .promptDividerActionButton:focus-visible
    )
    .promptDividerSeparatorButton
    :global(.cthulhuUiSeparator) {
    border-color: var(--ui-accent-normal-border);
  }

  .promptDividerSeparatorButton:focus-visible,
  .promptDividerActionButton:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: -2px;
  }
</style>
