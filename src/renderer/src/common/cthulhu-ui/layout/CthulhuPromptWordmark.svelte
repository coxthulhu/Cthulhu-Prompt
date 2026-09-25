<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = Omit<HTMLAttributes<HTMLHeadingElement>, 'children'>

  let { class: className, ...restProps }: Props = $props()
</script>

<h1
  class={mergeClasses('cthulhuUiWordmark m-0 text-6xl leading-none font-semibold', className)}
  {...restProps}
>
  Cthulhu <span class="cthulhuUiWordmarkAccent">Prompt</span>
</h1>

<style>
  .cthulhuUiWordmark {
    color: var(--ui-normal-text);
    font-family: ui-sans-serif, system-ui, sans-serif;
    letter-spacing: -0.055em;
  }

  .cthulhuUiWordmarkAccent {
    color: var(--ui-accent-link-text);
  }
</style>
