<script lang="ts">
  import { Plus } from 'lucide-svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import DropTarget, {
    type DropTargetState
  } from '@renderer/common/drag-drop/DropTarget.svelte'
  import type {
    DroppableOptions,
    DroppableState
  } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import type {
    CategoryDragPayload,
    CategoryDropPayload,
    PromptHandleDragPayload,
    PromptHandleDropPayload
  } from '@renderer/features/prompt-drag-drop/promptHandleDrag'
  import { PROMPT_DIVIDER_ROW_HEIGHT_PX } from './promptDividerSizing'

  let {
    onAddPrompt,
    mode = 'add',
    contentLabel = 'Prompt',
    disabled = false,
    revealed = false,
    testId,
    getDropOptions,
    getCategoryDropOptions,
    indicatorState
  }: {
    onAddPrompt?: () => void
    mode?: 'add' | 'separator'
    contentLabel?: 'Prompt' | 'Template'
    disabled?: boolean
    /** Keeps the add button visible while retaining hover and focus colors. */
    revealed?: boolean
    testId?: string
    getDropOptions?: () => DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
    /** Category-only options sharing this entire visual divider row. */
    getCategoryDropOptions?: () => DroppableOptions<CategoryDragPayload, CategoryDropPayload>
    indicatorState?: DroppableState
  } = $props()
</script>

{#snippet dividerContent({ isOver = false, isBlocked = false } = {})}
  {@const dividerText = isOver ? 'Move Here' : `Add ${contentLabel}`}
  <div
    class="promptDividerRow grid w-full items-center"
    data-revealed={revealed}
    data-drop-over={isOver ? 'true' : 'false'}
    data-drop-blocked={isBlocked ? 'true' : undefined}
    style={`height:${PROMPT_DIVIDER_ROW_HEIGHT_PX}px;`}
  >
    <div
      class={(mode === 'separator' && !isOver) || (isOver && isBlocked)
        ? 'grid h-full grid-cols-1 items-center'
        : 'promptDividerContent grid h-full items-center'}
    >
      {#if (mode === 'separator' && !isOver) || (isOver && isBlocked)}
        <!-- Completed rows and blocked drops use one uninterrupted separator. -->
        <Separator
          data-testid={isOver && isBlocked ? testId : undefined}
          class={isOver
            ? `!h-2.5 rounded-full !border-0 ${isBlocked ? '!bg-[var(--ui-muted-icon-glyph)]' : '!bg-[var(--ui-info-strong-border)]'}`
            : undefined}
        />
      {:else if isOver}
        <Separator
          class={`!h-2.5 rounded-full !border-0 ${isBlocked ? '!bg-[var(--ui-muted-icon-glyph)]' : '!bg-[var(--ui-info-strong-border)]'}`}
        />
        <div
          class="promptDividerMoveIndicator text-sm"
          data-drop-over="true"
          data-testid={testId}
          aria-label={dividerText}
        >
          <span>{dividerText}</span>
        </div>
        <Separator
          class={`!h-2.5 rounded-full !border-0 ${isBlocked ? '!bg-[var(--ui-muted-icon-glyph)]' : '!bg-[var(--ui-info-strong-border)]'}`}
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
            class="promptDividerActionButton text-xs leading-4"
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

<!-- Prompt and category actions use nested registrations because their drag types never overlap. -->
{#snippet promptDropTarget(categoryTargetState?: DropTargetState)}
  {#if getDropOptions}
    <DropTarget getOptions={getDropOptions}>
      {#snippet children(promptTargetState)}
        {@const resolvedState = promptTargetState.isOver
          ? promptTargetState
          : (categoryTargetState ?? indicatorState)}
        {@render dividerContent(resolvedState)}
      {/snippet}
    </DropTarget>
  {:else}
    {@render dividerContent(categoryTargetState ?? indicatorState)}
  {/if}
{/snippet}

<!-- Keep the button mounted when its category drop registration changes. -->
<DropTarget
  getOptions={getCategoryDropOptions}
  data-testid={getCategoryDropOptions && testId ? `${testId}-category-drop-target` : undefined}
>
  {#snippet children(categoryTargetState)}
    {@render promptDropTarget(getCategoryDropOptions ? categoryTargetState : undefined)}
  {/snippet}
</DropTarget>

<style>
  .promptDividerMoveIndicator {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
    display: inline-flex;
    flex: 0 0 auto;
    font-weight: var(--font-weight-semibold);
    height: 26px;
    justify-content: center;
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
    gap: 4px;
    height: 100%;
    padding: 0;
    transition: color var(--ui-animation-duration-standard) ease;
    white-space: nowrap;
  }

  .promptDividerActionButton:disabled {
    cursor: default;
  }

  .promptDividerRow[data-revealed='true'] .promptDividerActions,
  .promptDividerRow:hover .promptDividerActions,
  .promptDividerRow:focus-within .promptDividerActions {
    opacity: 1;
  }

  .promptDividerRow:hover .promptDividerActionButton,
  .promptDividerRow:focus-within .promptDividerActionButton {
    color: var(--ui-accent-normal-text);
  }

  .promptDividerContent:has(
      .promptDividerSeparatorButton:hover,
      .promptDividerActionButton:hover
    )
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
