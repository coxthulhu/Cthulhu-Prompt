<script lang="ts">
  import { mergeClasses } from './mergeClasses'

  type Props = {
    text: string
    title?: string
    class?: string
    testId?: string
  }

  let { text, title, class: className, testId }: Props = $props()
</script>

<span
  class={mergeClasses('cthulhuUiFlatValuePill', className)}
  title={title ?? text}
  data-testid={testId}
>
  {text}
</span>

<style>
  .cthulhuUiFlatValuePill {
    border: 1px solid var(--ui-flat-neutral-normal-border);
    border-radius: 999px;
    color: var(--ui-flat-normal-text);
    flex: 0 0 auto;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.25;
    max-width: 11rem;
    min-width: 0;
    overflow: hidden;
    padding: 4px 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
