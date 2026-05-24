<script lang="ts">
  import { ArrowDownToLine, Plus } from 'lucide-svelte'
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
    disabled = false,
    testId,
    getDropOptions
  }: {
    onAddPrompt?: () => void
    disabled?: boolean
    testId?: string
    getDropOptions?: () => DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
  } = $props()
</script>

{#snippet dividerContent({ isOver = false } = {})}
  {@const DividerIcon = isOver ? ArrowDownToLine : Plus}
  {@const dividerText = isOver ? 'Move here' : 'Add prompt'}
  <div
    class="promptDividerRow grid items-center"
    data-drop-over={isOver ? 'true' : 'false'}
    style={`height:${PROMPT_DIVIDER_ROW_HEIGHT_PX}px;`}
  >
    <div class="grid min-h-9 grid-cols-[minmax(24px,1fr)_auto_minmax(24px,1fr)] items-center gap-2.5">
      <Separator
        class={isOver
          ? '!h-2.5 rounded-full border border-[var(--ui-info-normal-border)] !bg-[var(--ui-info-normal-surface)] shadow-[0_0_0_1px_var(--ui-info-normal-border),inset_0_1px_0_var(--ui-card-nested-raised-inset-highlight)]'
          : 'bg-[var(--ui-neutral-muted-border)]'}
      />
      <button
        type="button"
        class="promptDividerPillButton"
        data-drop-over={isOver ? 'true' : 'false'}
        data-testid={testId}
        aria-label={dividerText}
        {disabled}
        onclick={() => {
          onAddPrompt?.()
        }}
      >
        <DividerIcon class="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
        <span class="promptDividerPillLabelStack" aria-hidden="true">
          <span class="promptDividerPillLabel" data-active={!isOver}>Add prompt</span>
          <span class="promptDividerPillLabel" data-active={isOver}>Move here</span>
        </span>
      </button>
      <!-- Add subfolder is parked until prompt folders support nested creation. -->
      <Separator
        class={isOver
          ? '!h-2.5 rounded-full border border-[var(--ui-info-normal-border)] !bg-[var(--ui-info-normal-surface)] shadow-[0_0_0_1px_var(--ui-info-normal-border),inset_0_1px_0_var(--ui-card-nested-raised-inset-highlight)]'
          : 'bg-[var(--ui-neutral-muted-border)]'}
      />
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
  .promptDividerPillButton {
    align-items: center;
    background-color: var(--ui-accent-normal-surface);
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: 999px;
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-accent-normal-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 750;
    gap: 7px;
    height: 30px;
    justify-content: center;
    line-height: 16px;
    padding: 0 12px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
    white-space: nowrap;
  }

  .promptDividerPillButton:hover {
    background-color: var(--ui-accent-hover-surface);
    border-color: var(--ui-accent-hover-border);
    color: var(--ui-normal-text);
  }

  .promptDividerPillButton[data-drop-over='true'],
  .promptDividerPillButton[data-drop-over='true']:hover {
    background-color: var(--ui-info-normal-surface);
    border-color: var(--ui-info-normal-border);
    box-shadow:
      0 0 0 1px var(--ui-info-normal-border),
      0 8px 22px var(--ui-shadow-raised),
      inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight);
    color: var(--ui-normal-text);
  }

  .promptDividerPillButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .promptDividerPillLabelStack {
    display: grid;
  }

  .promptDividerPillLabel {
    grid-area: 1 / 1;
  }

  .promptDividerPillLabel[data-active='false'] {
    opacity: 0;
  }
</style>
