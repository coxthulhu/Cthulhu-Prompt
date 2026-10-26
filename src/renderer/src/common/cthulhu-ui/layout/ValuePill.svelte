<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    text: string
    title?: string
    icon?: ComponentType
    class?: string
    testId?: string
  }

  let { text, title, icon: Icon, class: className, testId }: Props = $props()
</script>

<span
  class={mergeClasses('cthulhuUiValuePill min-w-0 truncate text-sm', className)}
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
    font-weight: var(--font-weight-semibold);
    gap: 6px;
    max-width: 11rem;
    padding: 4px 12px;
  }
</style>
