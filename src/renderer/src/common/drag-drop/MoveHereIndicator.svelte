<script lang="ts">
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    /** Draws one gray bar without the label when the drop would change nothing. */
    isBlocked?: boolean
    /** Test ID on the label, or on the gray bar while blocked. */
    testId?: string
    class?: string
  }

  let { isBlocked = false, testId, class: className }: Props = $props()

  /** Pill bar shared by the blue and gray states. */
  const barClass = $derived(
    `!h-2.5 rounded-full !border-0 ${isBlocked ? '!bg-[var(--ui-muted-icon-glyph)]' : '!bg-[var(--ui-info-strong-border)]'}`
  )
</script>

<!-- Horizontal drop indicator: blue bars around a Move Here label, or one gray bar when the drop changes nothing. -->
<div
  class={mergeClasses('moveHereIndicator grid items-center', className)}
  data-blocked={isBlocked ? 'true' : undefined}
>
  {#if isBlocked}
    <Separator data-testid={testId} class={barClass} />
  {:else}
    <Separator class={barClass} />
    <div class="moveHereIndicatorLabel text-sm" data-testid={testId}>
      <span>Move Here</span>
    </div>
    <Separator class={barClass} />
  {/if}
</div>

<style>
  .moveHereIndicator {
    grid-template-columns: minmax(24px, 1fr) auto minmax(24px, 1fr);
  }

  .moveHereIndicator[data-blocked='true'] {
    grid-template-columns: minmax(0, 1fr);
  }

  .moveHereIndicatorLabel {
    align-items: center;
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
</style>
