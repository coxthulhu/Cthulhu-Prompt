<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type FlatTitleSize = 'page'
  type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

  type Props = HTMLAttributes<HTMLElement> & {
    title: string
    headingLevel?: HeadingLevel
    size?: FlatTitleSize
  }

  let {
    title,
    headingLevel = 1,
    size = 'page',
    class: className,
    ...restProps
  }: Props = $props()

  const titleTag = $derived(`h${headingLevel}`)
</script>

<svelte:element
  this={titleTag}
  class={mergeClasses('cthulhuUiFlatTitle', className)}
  data-size={size}
  {...restProps}
>
  {title}
</svelte:element>

<style>
  .cthulhuUiFlatTitle {
    color: var(--ui-flat-normal-text);
    font-weight: 700;
    letter-spacing: 0;
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .cthulhuUiFlatTitle[data-size='page'] {
    font-size: 2rem;
    line-height: 1.15;
  }
</style>
