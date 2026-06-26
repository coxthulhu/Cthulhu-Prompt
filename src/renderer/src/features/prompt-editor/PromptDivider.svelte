<script lang="ts">
  import { ArrowDownToLine, FolderPlus, Plus } from 'lucide-svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
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
        : 'grid min-h-9 grid-cols-[minmax(24px,1fr)_auto_minmax(24px,1fr)] items-center gap-2.5'}
    >
      <Separator
        class={isOver
          ? '!h-2.5 rounded-full !bg-[var(--ui-info-strong-border)]'
          : 'bg-[var(--ui-neutral-muted-border)]'}
      />
      {#if mode === 'separator'}
        <!-- Completed mode uses the divider as a plain section separator. -->
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
          <IconTextButton
            icon={DividerIcon}
            text={dividerText}
            iconSize={14}
            iconClass="stroke-[3]"
            state={disabled ? 'disabled' : 'enabled'}
            hoverVariant="accent"
            class="min-w-24 font-bold"
            data-drop-over="false"
            aria-label={dividerText}
            {testId}
            onclick={() => {
              onAddPrompt?.()
            }}
          />
          {#if onAddSubfolder}
            <IconTextButton
              icon={FolderPlus}
              text="Add Subfolder"
              iconSize={14}
              iconClass="stroke-[3]"
              state={disabled ? 'disabled' : 'enabled'}
              hoverVariant="accent"
              class="min-w-32 font-bold"
              data-drop-over="false"
              aria-label="Add Subfolder"
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
  }

  .promptDividerActions {
    align-items: center;
    display: inline-flex;
    gap: 4px;
    min-width: 0;
  }
</style>
