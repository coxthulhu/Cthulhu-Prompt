<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type FlatTitleSize = 'page' | 'small'
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

{#if size === 'small'}
  <div class={mergeClasses('cthulhuUiFlatTitle', className)} data-size={size} {...restProps}>
    <div class="cthulhuUiFlatTitleSmallText">
      <svelte:element this={titleTag} class="cthulhuUiFlatTitleSmallHeading">
        {title}
      </svelte:element>
    </div>
  </div>
{:else}
  <svelte:element
    this={titleTag}
    class={mergeClasses('cthulhuUiFlatTitle', className)}
    data-size={size}
    {...restProps}
  >
    {title}
  </svelte:element>
{/if}

<style>
  .cthulhuUiFlatTitle[data-size='page'] {
    color: var(--ui-flat-normal-text);
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.15;
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .cthulhuUiFlatTitleSmallText {
    min-width: 0;
  }

  .cthulhuUiFlatTitleSmallHeading {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 600;
  }
</style>
