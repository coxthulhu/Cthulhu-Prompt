<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  /** Content for a numbered instruction with a supporting tip. */
  type Props = {
    number: number
    icon: ComponentType
    title: string
    description: string
    badge?: string
    tip: Snippet
    class?: string
  }

  /** Each row shares the same number, heading, description, and tip alignment. */
  let { number, icon: Icon, title, description, badge, tip, class: className }: Props = $props()
</script>

<!-- Reusable instruction row rendered inside an ordered list. -->
<li class={mergeClasses('cthulhuUiNumberedStepRow text-sm leading-6', className)}>
  <span class="cthulhuUiNumberedStepNumber text-xl leading-10 font-semibold">{number}</span>
  <div class="min-w-0">
    <div class="cthulhuUiNumberedStepHeading">
      <Icon size={19} aria-hidden="true" />
      <h2 class="text-base leading-6 font-semibold">{title}</h2>
      {#if badge}
        <span class="cthulhuUiNumberedStepBadge text-sm leading-5">{badge}</span>
      {/if}
    </div>
    <p>{description}</p>
    <div class="cthulhuUiNumberedStepTip text-sm leading-5">{@render tip()}</div>
  </div>
</li>

<style>
  .cthulhuUiNumberedStepRow {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 18px;
    padding: 20px 0;
    color: var(--ui-hoverable-text);
  }

  .cthulhuUiNumberedStepRow:not(:first-child) {
    border-top: 1px solid var(--ui-neutral-muted-border);
  }

  .cthulhuUiNumberedStepNumber {
    width: 42px;
    height: 42px;
    text-align: center;
    border: 1px solid var(--ui-accent-muted-border);
    border-radius: 50%;
    color: var(--ui-normal-text);
    background: var(--ui-accent-action-fill);
  }

  .cthulhuUiNumberedStepHeading {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 9px;
    margin-bottom: 6px;
    color: var(--ui-normal-text);
  }

  .cthulhuUiNumberedStepHeading :global(svg) {
    flex-shrink: 0;
    color: var(--ui-hoverable-icon-glyph);
  }

  .cthulhuUiNumberedStepBadge {
    padding: 0 8px;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 4px;
    color: var(--ui-muted-text);
  }

  .cthulhuUiNumberedStepTip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    color: var(--ui-muted-text);
  }
</style>
