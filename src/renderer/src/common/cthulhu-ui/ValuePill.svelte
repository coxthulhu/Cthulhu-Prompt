<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ValuePillVariant = 'default' | 'todo' | 'in-progress' | 'completed'

  type Props = {
    text: string
    title?: string
    variant?: ValuePillVariant
    icon?: ComponentType
    class?: string
    testId?: string
  }

  let { text, title, variant = 'default', icon: Icon, class: className, testId }: Props = $props()
</script>

<span
  class={mergeClasses('cthulhuUiValuePill', className)}
  data-variant={variant}
  title={title ?? text}
  data-testid={testId}
>
  {#if Icon}
    <Icon size={14} aria-hidden="true" />
  {/if}
  <span>{text}</span>
</span>

<style>
  .cthulhuUiValuePill {
    align-items: center;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 999px;
    color: var(--ui-normal-text);
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 14px;
    font-weight: 500;
    gap: 6px;
    line-height: 1.25;
    max-width: 11rem;
    min-width: 0;
    overflow: hidden;
    padding: 4px 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiValuePill[data-variant='todo'],
  .cthulhuUiValuePill[data-variant='in-progress'],
  .cthulhuUiValuePill[data-variant='completed'] {
    box-sizing: border-box;
    justify-content: center;
    max-width: none;
    padding: 4px;
    width: 116px;
  }

  .cthulhuUiValuePill[data-variant='todo'] {
    color: var(--ui-secondary-text);
  }

  .cthulhuUiValuePill[data-variant='completed'] {
    border-color: var(--ui-success-normal-border);
    color: var(--ui-success-normal-text);
  }

  .cthulhuUiValuePill[data-variant='in-progress'] {
    border-color: var(--ui-warning-normal-border);
    color: var(--ui-warning-icon-glyph);
  }

  .cthulhuUiValuePill[data-variant='todo'] :global(svg) {
    color: var(--ui-secondary-icon-glyph);
    flex: 0 0 auto;
  }

  .cthulhuUiValuePill[data-variant='in-progress'] :global(svg) {
    color: var(--ui-warning-icon-glyph);
    flex: 0 0 auto;
  }

  .cthulhuUiValuePill[data-variant='completed'] :global(svg) {
    color: var(--ui-success-normal-text);
    flex: 0 0 auto;
  }
</style>
