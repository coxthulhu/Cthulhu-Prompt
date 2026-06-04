<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import CardSurface from './CardSurface.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    label: string
    children: Snippet
    surfaceClass?: string
  }

  let {
    label,
    children,
    surfaceClass,
    class: className,
    ...restProps
  }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiFlatCard', className)} {...restProps}>
  <div class="cthulhuUiFlatCardLabel">
    <span>{label}</span>
  </div>

  <!-- Flat labelled card shell for action and display row groups. -->
  <CardSurface class={mergeClasses('cthulhuUiFlatCardSurface w-full min-w-0', surfaceClass)} variant="flat">
    {@render children()}
  </CardSurface>
</div>

<style>
  .cthulhuUiFlatCard {
    min-width: 0;
  }

  .cthulhuUiFlatCardLabel {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 18px;
    font-weight: 500;
    gap: 10px;
    letter-spacing: 0;
    line-height: 1.2;
    margin-bottom: 12px;
    padding-left: 8px;
  }
</style>
