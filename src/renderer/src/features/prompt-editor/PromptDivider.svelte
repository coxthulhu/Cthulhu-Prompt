<script lang="ts">
  import { Plus } from 'lucide-svelte'
  import IconPillButton from '@renderer/common/cthulhu-ui/IconPillButton.svelte'
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
  <div
    class="promptDividerRow grid items-center"
    data-drop-over={isOver ? 'true' : 'false'}
    style={`height:${PROMPT_DIVIDER_ROW_HEIGHT_PX}px;`}
  >
    <div class="grid min-h-9 grid-cols-[minmax(24px,1fr)_auto_minmax(24px,1fr)] items-center gap-2.5">
      <Separator
        class={isOver
          ? '!bg-[var(--ui-info-strong-border)]'
          : 'bg-[var(--ui-neutral-muted-border)]'}
      />
      <IconPillButton
        icon={Plus}
        text="Add prompt"
        iconClass="stroke-[3]"
        class={isOver
          ? '!border-[var(--ui-info-normal-border)] !bg-[var(--ui-info-normal-surface)] !text-[var(--ui-normal-text)]'
          : undefined}
        {disabled}
        {testId}
        onclick={() => {
          onAddPrompt?.()
        }}
      />
      <!-- Add subfolder is parked until prompt folders support nested creation. -->
      <Separator
        class={isOver
          ? '!bg-[var(--ui-info-strong-border)]'
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
