<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import CardSurface from './CardSurface.svelte'
  import Title from './Title.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    label: string
    children: Snippet
    surfaceClass?: string
  }

  let { label, children, surfaceClass, class: className, ...restProps }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiCard', className)} {...restProps}>
  <div class="cthulhuUiCardLabel">
    <Title title={label} variant="card" />
  </div>

  <!-- Labelled card shell for action and display row groups. -->
  <CardSurface class={surfaceClass}>
    {@render children()}
  </CardSurface>
</div>

<style>
  .cthulhuUiCard {
    min-width: 0;
  }

  .cthulhuUiCardLabel {
    align-items: center;
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    padding-left: 8px;
  }
</style>
