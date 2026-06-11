<script lang="ts">
  import { mergeClasses } from './mergeClasses'

  type Props = {
    text: string
    class?: string
    testId?: string
    title?: string
    onclick?: (event: MouseEvent) => void
  }

  let { text, class: className, testId, title, onclick }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiInlineTextButton', className)}
  data-testid={testId}
  {title}
  {onclick}
>
  {text}
</button>

<style>
  .cthulhuUiInlineTextButton {
    display: inline-flex;
    min-width: 0;
    cursor: pointer;
    align-items: center;
    border: 0;
    background: transparent;
    padding: var(--cthulhu-ui-inline-text-button-padding, 0);
    color: var(--ui-normal-text);
    font-size: 13px;
    font-weight: 400;
    line-height: var(--cthulhu-ui-inline-text-button-line-height, 18px);
    text-align: left;
    transition: color 50ms ease-out;
  }

</style>
