<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import FlatCardSurface from './FlatCardSurface.svelte'
  import FlatTitle from './FlatTitle.svelte'
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
    <FlatTitle title={label} variant="card" />
  </div>

  <!-- Flat labelled card shell for action and display row groups. -->
  <FlatCardSurface class={surfaceClass}>
    {@render children()}
  </FlatCardSurface>
</div>

<style>
  .cthulhuUiFlatCard {
    min-width: 0;
  }

  .cthulhuUiFlatCardLabel {
    align-items: center;
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    padding-left: 8px;
  }
</style>
